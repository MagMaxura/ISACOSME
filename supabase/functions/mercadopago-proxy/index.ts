// supabase/functions/mercadopago-proxy/index.ts

// Declare Deno to prevent TypeScript errors
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Inlined from _shared/cors.ts to fix bundling error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v9 - server-side ID type fix)');

/**
 * Parses a full Argentinian phone number string into an area code and local number,
 * handling mobile prefixes ('9') correctly for the Mercado Pago API.
 * @param phoneString The full phone number string from the user.
 * @returns An object with { area_code, number }.
 */
function parseArgentinianPhoneNumber(phoneString: string): { area_code: string; number: string } {
    console.log(`[PhoneParser v7] Attempting to parse: "${phoneString}"`);
    let cleanNumber = (phoneString || '').replace(/\D/g, '');

    // 1. Strip country code
    if (cleanNumber.startsWith('54')) {
        cleanNumber = cleanNumber.substring(2);
    }
    
    // 2. Identify if it's a mobile number (starts with 9) and temporarily remove the '9'
    const isMobile = cleanNumber.startsWith('9');
    if (isMobile) {
        cleanNumber = cleanNumber.substring(1);
    }
    
    // 3. Strip leading 0 for landlines (e.g., from '011...')
    if (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    let area_code = '';
    let number = '';

    // 4. Try to split area code and number, checking shorter ACs first
    const areaCodeLengths = [2, 3, 4]; // Corrected order
    for (const length of areaCodeLengths) {
        if (cleanNumber.length > length) {
            const potentialAreaCode = cleanNumber.substring(0, length);
            let potentialNumber = cleanNumber.substring(length);
            
            // Standard check: is the result a 10-digit number? (AC + Number)
            // Or a reasonable length for local numbers.
            if ((potentialAreaCode.length + potentialNumber.length === 10) || (potentialNumber.length >= 6 && potentialNumber.length <= 8)) {
                 area_code = potentialAreaCode;
                 number = potentialNumber;
                 break; // Found a good match, stop searching
            }
        }
    }
    
    // 5. If splitting failed, use fallback logic
    if (!area_code && cleanNumber.length >= 8) {
        console.warn(`[PhoneParser v7] Could not determine area code for "${cleanNumber}". Using fallback logic.`);
        if (cleanNumber.length > 8) { // e.g., for '1122334455', AC is '11', number is '22334455'
            number = cleanNumber.slice(-8);
            area_code = cleanNumber.slice(0, -8);
        } else {
            number = cleanNumber; // Assume no area code for shorter numbers
        }
    } else if (!area_code) {
        number = cleanNumber;
    }
    
    // The legacy '15' prefix is for mobile phones but is not used in the API.
    if (number.startsWith('15')) {
        number = number.substring(2);
    }

    // 6. Prepend the '9' back to the local number if it was a mobile
    if (isMobile) {
        number = '9' + number;
    }

    console.log(`[PhoneParser v7] Parsed result -> area_code=${area_code}, number=${number}`);
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