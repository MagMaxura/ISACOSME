// supabase/functions/mercadopago-proxy/index.ts

// Declare Deno to prevent TypeScript errors
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Inlined from _shared/cors.ts to fix bundling error
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v6 - guest checkout fix)');

/**
 * Parses a full Argentinian phone number string into an area code and local number.
 * This is a robust parser to fix common formatting issues.
 * @param phoneString The full phone number string from the user.
 * @returns An object with { area_code, number }.
 */
function parseArgentinianPhoneNumber(phoneString: string): { area_code: string; number: string } {
    let cleanNumber = (phoneString || '').replace(/\D/g, ''); // 1. Remove all non-digits

    // 2. Remove country code
    if (cleanNumber.startsWith('54')) {
        cleanNumber = cleanNumber.substring(2);
    }

    // 3. Remove mobile '9' prefix
    if (cleanNumber.startsWith('9')) {
        cleanNumber = cleanNumber.substring(1);
    }
    
    // 4. Remove leading '0' for landlines (e.g., 011 -> 11) - this can happen after stripping 549
    if (cleanNumber.startsWith('0')) {
        cleanNumber = cleanNumber.substring(1);
    }

    // 5. Identify area code (2, 3, or 4 digits) and remove legacy '15' prefix
    const areaCodeLengths = [4, 3, 2];
    for (const length of areaCodeLengths) {
        if (cleanNumber.length > length) {
            const potentialAreaCode = cleanNumber.substring(0, length);
            let potentialNumber = cleanNumber.substring(length);

            // Handle legacy '15' mobile prefix
            if (potentialNumber.startsWith('15')) {
                potentialNumber = potentialNumber.substring(2);
            }
            
            // A local number is usually 6-8 digits.
            if (potentialNumber.length >= 6 && potentialNumber.length <= 8) {
                console.log(`Phone parsed: ${phoneString} -> area_code=${potentialAreaCode}, number=${potentialNumber}`);
                return { area_code: potentialAreaCode, number: potentialNumber };
            }
        }
    }

    // Fallback: This is risky. Log a warning.
    console.warn(`Could not reliably determine area code for phone: ${phoneString}. Returning best guess.`);
    // If number is long, assume the last 8 digits are the number.
    if (cleanNumber.length > 8) {
         const number = cleanNumber.slice(-8);
         const area_code = cleanNumber.slice(0, -8);
         return { area_code, number };
    }
    
    // Last resort
    return { area_code: '', number: cleanNumber };
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!accessToken) throw new Error('Missing MP_ACCESS_TOKEN env variable.');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL env variable.');
    
    // --- Data Sanitization & Validation ---
    const parsedPhone = parseArgentinianPhoneNumber(rawPayer.phone?.number || '');
    const cleanDni = String(rawPayer.identification?.number || '').replace(/\D/g, '');
    const streetNumber = parseInt(rawPayer.address?.street_number, 10);
    if (isNaN(streetNumber) || streetNumber <= 0) {
       throw new Error(`El número de calle "${rawPayer.address?.street_number}" no es válido. Debe ser un número mayor que cero.`);
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
              type: rawPayer.identification?.type || 'DNI',
              number: cleanDni,
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
        success: `${supabaseUrl}/#/payment-success`,
        failure: `${supabaseUrl}/#/payment-failure`,
        pending: `${supabaseUrl}/#/payment-failure`,
      },
      auto_return: 'approved',
      notification_url: notification_url,
      statement_descriptor: "ISABELLA DE LA PERLA",
      // The 'purpose' key is removed to allow guest checkout
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