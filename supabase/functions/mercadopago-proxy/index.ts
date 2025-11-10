// supabase/functions/mercadopago-proxy/index.ts

// Declare Deno to prevent TypeScript errors
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Inlined from _shared/cors.ts to fix bundling error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v14 - street number as number)');

/**
 * Parses an Argentinian phone number into an area code and local number.
 * This version is stricter and throws an error for ambiguous formats, which is
 * caught and displayed to the user, preventing failures on the Mercado Pago page.
 * @param phoneString The full phone number string from the user.
 * @returns An object with { area_code, number }.
 * @throws An error if the phone number format is ambiguous or invalid.
 */
function parseArgentinianPhoneNumber(phoneString: string): { area_code: string; number: string } {
    console.log(`[PhoneParser v12] Parsing: "${phoneString}"`);
    if (!phoneString || phoneString.trim().length < 8) {
        throw new Error('El número de teléfono es demasiado corto. Debe incluir código de área.');
    }
    
    let clean = phoneString.replace(/\D/g, '');

    // --- Determine if it's a mobile number based on original input ---
    // The '9' after country code OR the presence of '15' are strong indicators.
    const originalNoSymbols = phoneString.replace(/[\s-()]/g, '');
    const isMobile = originalNoSymbols.startsWith('+549') || 
                     (originalNoSymbols.startsWith('15') && originalNoSymbols.length >= 8) ||
                     (clean.startsWith('9') && clean.length > 10); // e.g. 91122334455 (without +54)

    // --- Strip all common prefixes to get to the core 10 digits ---
    if (clean.startsWith('549')) clean = clean.substring(3);
    else if (clean.startsWith('54')) clean = clean.substring(2);
    
    if (clean.startsWith('9') && clean.length === 11) { // Handles cases like 91122334455
        clean = clean.substring(1);
    }
    
    if (clean.startsWith('0')) clean = clean.substring(1);

    let area_code = '';
    let number = '';
    
    if (clean.length === 10) {
        // Standard 10-digit number (AC + local)
        if (clean.startsWith('11')) { // Buenos Aires
            area_code = '11';
            number = clean.substring(2);
        } else if (['26','29','37','38'].some(prefix => clean.startsWith(prefix))) { // 4-digit ACs
            area_code = clean.substring(0, 4);
            number = clean.substring(4);
        } else { // 3-digit ACs
            area_code = clean.substring(0, 3);
            number = clean.substring(3);
        }
    } else if (clean.length === 8) {
        // User likely entered a Buenos Aires number without area code.
        area_code = '11';
        number = clean;
    } else {
        // The number is ambiguous.
        throw new Error(`El teléfono "${phoneString}" no es válido. Por favor, inclúyelo con código de área (ej: 1122334455).`);
    }

    // --- Finalize the local number part ---
    // The mobile prefix '15' is now obsolete but might be entered. It should be removed.
    if (number.startsWith('15')) {
        number = number.substring(2);
    }
    
    // Mercado Pago requires mobile numbers to be prefixed with '9'.
    if (isMobile) {
        number = '9' + number;
    }

    // Final sanity check
    if (!area_code || !number) {
        throw new Error(`No se pudo procesar el teléfono "${phoneString}".`);
    }

    console.log(`[PhoneParser v12] Result: area_code=${area_code}, number=${number}`);
    return { area_code, number };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, payer: rawPayer } = await req.json();
    console.log('Received raw request:', JSON.stringify({ items, payer: rawPayer }, null, 2));

    if (!items || !rawPayer) {
      throw new Error('Missing items or payer information.');
    }

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const appUrl = 'https://www.isabelladelaperla.app';

    if (!accessToken) throw new Error('Missing MP_ACCESS_TOKEN env variable.');
    
    // --- Data Sanitization & Validation ---
    const parsedPhone = parseArgentinianPhoneNumber(rawPayer.phone?.number || '');

    // Infer Identification Type on the server for robustness
    const rawIdNumber = String(rawPayer.identification?.number || '');
    const cleanIdNumber = rawIdNumber.replace(/\D/g, '');
    let idType = 'DNI';
    if (cleanIdNumber.length === 11) {
        idType = 'CUIT';
    }
    console.log(`[Proxy] Inferred ID type as ${idType} for number ${cleanIdNumber}`);
    
    const rawStreetNumber = rawPayer.address?.street_number;
    if (!rawStreetNumber || !/^\d+$/.test(rawStreetNumber)) {
       const userMessage = `El número de calle "${rawStreetNumber || ''}" no es válido. Debe contener solo números.`;
       console.error(`Validation Error: ${userMessage}`);
       throw new Error(userMessage);
    }
    const streetNumberInt = parseInt(rawStreetNumber, 10);

    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('x-forwarded-host');
    const notification_url = `${proto}://${host}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: items,
      payer: {
          name: rawPayer.name,
          surname: rawPayer.surname,
          email: rawPayer.email,
          phone: {
              area_code: parsedPhone.area_code,
              number: parsedPhone.number,
          },
          identification: {
              type: idType,
              number: cleanIdNumber,
          },
          address: {
              street_name: rawPayer.address?.street_name,
              street_number: streetNumberInt, // FIX: Send as a number, per API spec
              zip_code: rawPayer.address?.zip_code,
          },
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-failure`,
      },
      auto_return: 'approved',
      notification_url: notification_url,
      statement_descriptor: "ISABELLA DE LA PERLA",
    };
    
    console.log('Sending SANITIZED preference to Mercado Pago:', JSON.stringify(preference, null, 2));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Mercado Pago API error:', JSON.stringify(data, null, 2));
      const errorMessage = data.cause?.[0]?.description || data.message || 'Failed to create preference.';
      throw new Error(errorMessage);
    }

    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in mercadopago-proxy:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
