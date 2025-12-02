import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v28 - Ultra Robust / Deno.serve)');

// Helper function to sanitize phone numbers aggressively
function sanitizePhone(phone: string) {
    if (!phone) return { area_code: '11', number: '11111111' };
    
    // Keep only digits
    let clean = phone.replace(/\D/g, '');
    
    // If empty or too short, return default
    if (clean.length < 6) return { area_code: '11', number: '11111111' };

    // Remove common Argentina prefixes if present
    if (clean.startsWith('549')) clean = clean.substring(3);
    else if (clean.startsWith('54')) clean = clean.substring(2);
    
    // Remove leading zero (e.g. 011...)
    if (clean.startsWith('0')) clean = clean.substring(1);

    // Default splitting logic
    let area_code = '11';
    let number = clean;

    if (clean.length >= 10) {
        if (clean.startsWith('11')) {
            area_code = '11';
            number = clean.substring(2);
        } else {
            // Assume interior (3 or 4 digit area code)
            area_code = clean.substring(0, 3);
            number = clean.substring(3);
        }
    }

    // Mercado Pago has length limits, ensure we don't exceed them
    return { 
        area_code: area_code.substring(0, 5), 
        number: number.substring(0, 15) 
    };
}

// Main handler using Deno.serve (standard for Supabase Edge Functions)
Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, payer: rawPayer, external_reference } = await req.json();

    console.log('Generating Preference. Sale ID:', external_reference);

    if (!items || items.length === 0) throw new Error('El carrito está vacío.');
    
    // Fallback if payer data is missing
    const payerData = rawPayer || {};

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    // Base URL for returns
    const appUrl = 'https://www.isabelladelaperla.app'; 

    if (!accessToken) throw new Error('Falta Token de Mercado Pago en el servidor.');

    // --- DATA SANITIZATION (CRITICAL TO PREVENT MP ERRORS) ---
    
    // 1. Phone: Always return a valid object
    const phoneObj = sanitizePhone(payerData.phone?.number || '');

    // 2. Identification: Clean and ensure type
    let rawId = String(payerData.identification?.number || '').replace(/\D/g, '');
    // If no DNI, use generic consumer final
    if (!rawId || rawId.length < 6) rawId = '11111111'; 
    const idType = rawId.length > 9 ? 'CUIT' : 'DNI';

    // 3. Address: Ensure positive integer for street number
    let streetNum = parseInt(payerData.address?.street_number, 10);
    if (isNaN(streetNum) || streetNum <= 0) streetNum = 1;
    
    const streetName = payerData.address?.street_name || 'Calle';
    const zipCode = payerData.address?.zip_code || '1000';

    // 4. Email: Basic validation. MP rejects invalid emails.
    let email = payerData.email || 'cliente@anonimo.com';
    if (!email.includes('@')) email = 'cliente@anonimo.com';

    // 5. Items: Ensure correct number formats
    const cleanItems = items.map((item: any) => ({
        id: String(item.id).substring(0, 250),
        title: String(item.title).substring(0, 250),
        description: String(item.title).substring(0, 250),
        quantity: Math.max(1, Math.floor(Number(item.quantity))), // Positive Integer
        unit_price: Number(Number(item.unit_price).toFixed(2)), // Max 2 decimals
        currency_id: 'ARS'
    }));

    // Dynamic Webhook URL construction
    const reqUrl = new URL(req.url);
    const webhookUrl = `${reqUrl.origin}/functions/v1/mercadopago-webhook`;

    const preferencePayload = {
      items: cleanItems,
      external_reference: external_reference, // Our Sale ID
      payer: {
        name: payerData.name || 'Cliente',
        surname: payerData.surname || 'Web',
        email: email,
        date_created: new Date().toISOString(),
        phone: phoneObj,
        identification: { type: idType, number: rawId },
        address: {
          street_name: streetName,
          street_number: streetNum,
          zip_code: zipCode
        }
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-failure`
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
      statement_descriptor: "ISABELLA PERLA", // Max 22 chars
      binary_mode: false // Allow pending payments (PagoFácil, Rapipago)
    };

    console.log('Sending preference to MP:', JSON.stringify(preferencePayload));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preferencePayload)
    });

    const mpData = await response.json();
    
    if (!response.ok) {
        console.error('MP Response Error:', mpData);
        throw new Error(mpData.message || 'Mercado Pago rechazó la solicitud.');
    }

    return new Response(JSON.stringify({ init_point: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Proxy Logic Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});