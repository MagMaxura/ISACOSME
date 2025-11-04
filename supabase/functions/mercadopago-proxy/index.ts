// supabase/functions/mercadopago-proxy/index.ts

// FIX: Declare Deno to prevent TypeScript errors in a non-Deno environment.
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Mercado Pago Proxy function initialized');

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, payer } = await req.json();

    if (!items || !payer) {
      throw new Error('Missing items or payer information in the request body.');
    }

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('Missing Mercado Pago Access Token in environment variables.');
    }
    
    // Get the base URL of the Supabase function deployment to construct the webhook URL
    const functionUrl = req.headers.get('x-forwarded-proto') + '://' + req.headers.get('x-forwarded-host') + '/functions/v1/';

    const preference = {
      items: items,
      payer: payer,
      back_urls: {
        success: `${Deno.env.get('SUPABASE_URL')}/#/payment-success`,
        failure: `${Deno.env.get('SUPABASE_URL')}/#/payment-failure`,
        pending: `${Deno.env.get('SUPABASE_URL')}/#/payment-failure`,
      },
      auto_return: 'approved',
      // This is the crucial part: it tells Mercado Pago where to send a notification (webhook)
      // when the payment status changes (e.g., from 'pending' to 'approved').
      notification_url: `${functionUrl}mercadopago-webhook`,
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