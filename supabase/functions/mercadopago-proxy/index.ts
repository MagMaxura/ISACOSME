// supabase/functions/mercadopago-proxy/index.ts

// Declare Deno to prevent TypeScript errors
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Inlined from _shared/cors.ts to fix bundling error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v10 - robust phone parser)');

/**
 * Parses a full Argentinian phone number string into an area code and local number.
 * This version uses a more robust heuristic to distinguish between 2, 3, and 4-digit area codes.
 * @param phoneString The full phone number string from the user.
 * @returns An object with { area_code, number }.
 */
function parseArgentinianPhoneNumber(phoneString: string): { area_code: string; number: string } {
    console.log(`[PhoneParser v10] Attempting to parse: "${phoneString}"`);
    let cleanNumber = (phoneString || '').replace(/\D/g, '');

    // 1. Strip country code if present
    if (cleanNumber.startsWith('54')) {
        cleanNumber = cleanNumber.substring(2);
    }

    // 2. Identify and handle mobile '9'
    const isMobile = cleanNumber.startsWith('9');
    if (isMobile) {
        cleanNumber = cleanNumber.substring(1); // Temporarily remove '9'
    }
    
    // 3. Handle and strip leading '0' (for landlines like 011...)
    if (cleanNumber.startsWith('0')) {
        cleanNumber = cleanNumber.substring(1);
    }
    
    let area_code = '';
    let number = '';

    // Argentinian numbering plan: AC (2-4 digits) + Number (6-8 digits) = 10 digits total.
    if (cleanNumber.length === 10) {
        // First, check for the only 2-digit area code (Buenos Aires)
        if (cleanNumber.startsWith('11')) {
            area_code = '11';
            number = cleanNumber.substring(2);
        } 
        // Heuristic for 4-digit area codes (less common, but specific prefixes)
        else if (cleanNumber.startsWith('29') || cleanNumber.startsWith('38') || cleanNumber.startsWith('37') || cleanNumber.startsWith('26')) {
            area_code = cleanNumber.substring(0, 4);
            number = cleanNumber.substring(4);
        }
        // Assume the rest are the most common 3-digit area codes
        else {
            area_code = cleanNumber.substring(0, 3);
            number = cleanNumber.substring(3);
        }
    } else {
        // Fallback for non-standard lengths, this is less reliable
        console.warn(`[PhoneParser v10] Cleaned number length is ${cleanNumber.length}, not 10. Using fallback.`);
        if (cleanNumber.length > 7) { // Guess a split point for longer numbers
            number = cleanNumber.slice(-7);
            area_code = cleanNumber.slice(0, -7);
        } else { // Assume no area code for short numbers
            number = cleanNumber;
        }
    }

    // 4. Prepend the '9' back to the local number if it was a mobile
    if (isMobile) {
        number = '9' + number;
    }
    
    // 5. Remove legacy '15' prefix from local number if present. This is obsolete but might be entered by users.
    if (isMobile && number.startsWith('915')) {
         number = '9' + number.substring(3);
    } else if (!isMobile && number.startsWith('15')) {
         number = number.substring(2);
    }
    
    console.log(`[PhoneParser v10] Parsed result -> area_code=${area_code}, number=${number}`);
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
    
    const streetNumber = parseInt(rawPayer.address?.street_number, 10);

    if (isNaN(streetNumber) || streetNumber <= 0) {
       const userMessage = `El número de calle "${rawPayer.address?.street_number}" no es válido. Debe ser un número mayor que cero.`;
       console.error(`Validation Error: ${userMessage}`);
       throw new Error(userMessage);
    }

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
              street_number: streetNumber,
              zip_code: rawPayer.address?.zip_code,
          },
      },
      shipments: {
        receiver_address: {
          zip_code: rawPayer.address?.zip_code,
          street_name: rawPayer.address?.street_name,
          street_number: streetNumber,
        },
        mode: "not_specified",
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