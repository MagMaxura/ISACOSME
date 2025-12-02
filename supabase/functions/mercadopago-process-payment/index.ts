import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Mercado Pago Process Payment Function Initialized");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { formData, external_reference } = await req.json();
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (!accessToken) throw new Error('Server config error: Missing MP Token');

    console.log(`Processing payment for Sale ID: ${external_reference}`);

    // Build the payment payload.
    // We use fetch directly to the API to avoid dependency issues with the Node SDK in Deno Edge environment.
    const paymentBody = {
        ...formData,
        external_reference: external_reference,
        statement_descriptor: "ISABELLA PERLA",
        additional_info: {
            items: formData.additional_info?.items || [],
            payer: {
                first_name: formData.payer?.first_name,
                last_name: formData.payer?.last_name,
                phone: {
                    area_code: formData.payer?.phone?.area_code,
                    number: formData.payer?.phone?.number
                },
                address: formData.payer?.address
            },
            shipments: {
                receiver_address: formData.payer?.address
            }
        }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID() // Prevent duplicate charges on network retries
        },
        body: JSON.stringify(paymentBody)
    });

    const paymentResult = await response.json();

    if (!response.ok) {
        console.error('MP API Error:', paymentResult);
        // We throw the error message from MP to display it in the Brick
        throw new Error(paymentResult.message || 'Error procesando el pago en Mercado Pago');
    }

    console.log('Payment processed. Status:', paymentResult.status);

    return new Response(JSON.stringify(paymentResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Payment Processing Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});