// supabase/functions/mercadopago-proxy/index.ts

// Declare Deno to prevent TypeScript errors in a non-Deno environment.
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Mercado Pago Proxy function initialized');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, payer } = await req.json();

    if (!items || !payer) {
      throw new Error('Missing items or payer information in the request body.');
    }

    // Securely get environment variables from Supabase dashboard
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!accessToken) throw new Error('Missing MP_ACCESS_TOKEN in environment variables.');
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL in environment variables.');
    
    // Dynamically construct the webhook notification URL from request headers.
    // This is more robust than hardcoding and works across different environments.
    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('x-forwarded-host');
    const notification_url = `${proto}://${host}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: items,
      payer: payer,
      back_urls: {
        success: `${supabaseUrl}/#/payment-success`,
        failure: `${supabaseUrl}/#/payment-failure`,
        pending: `${supabaseUrl}/#/payment-failure`,
      },
      auto_return: 'approved',
      // This tells Mercado Pago where to send a server-to-server notification (webhook)
      // when the payment status changes.
      notification_url: notification_url,
    };

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
      console.error('Mercado Pago API error:', data);
      throw new Error(data.message || 'Failed to create preference.');
    }

    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in mercadopago-proxy:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
