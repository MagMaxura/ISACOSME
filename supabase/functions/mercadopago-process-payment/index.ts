
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Mercado Pago Process Payment Function Initialized (v4 - Enhanced Data)");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { formData, external_reference, payerInfo, items } = await req.json();
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (!accessToken) throw new Error('Server config error: Missing MP Token');

    console.log(`Processing payment for Sale ID: ${external_reference}`);

    // Build a robust payment payload
    // Using formData from the Brick + payerInfo from the App for 'additional_info'
    const paymentBody = {
        token: formData.token,
        issuer_id: formData.issuer_id,
        payment_method_id: formData.payment_method_id,
        transaction_amount: formData.transaction_amount,
        installments: formData.installments,
        payer: {
            email: formData.payer.email || payerInfo.email,
            identification: formData.payer.identification // DNI from brick
        },
        external_reference: external_reference,
        statement_descriptor: "ISABELLA PERLA",
        description: `Pedido Web ${external_reference}`,
        additional_info: {
            items: items ? items.map((i: any) => ({
                id: i.id,
                title: i.nombre,
                quantity: i.quantity,
                unit_price: Number(i.unitPrice)
            })) : [],
            payer: {
                first_name: payerInfo.name,
                last_name: payerInfo.surname,
                phone: {
                    area_code: "", 
                    number: payerInfo.phone
                },
                address: {
                    zip_code: payerInfo.zip_code,
                    street_name: payerInfo.street_name,
                    street_number: parseInt(payerInfo.street_number) || 0
                }
            },
            shipments: {
                receiver_address: {
                    zip_code: payerInfo.zip_code,
                    street_name: payerInfo.street_name,
                    street_number: parseInt(payerInfo.street_number) || 0,
                    floor: "",
                    apartment: ""
                }
            }
        }
    };

    console.log("Payment Body prepared (partial log):", JSON.stringify({ ...paymentBody, token: 'HIDDEN' }));

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify(paymentBody)
    });

    const paymentResult = await response.json();

    if (!response.ok) {
        console.error('MP API Failed:', JSON.stringify(paymentResult, null, 2));
        const errorDetail = paymentResult.cause?.[0]?.description || paymentResult.message || 'Unknown MP Error';
        throw new Error(`Mercado Pago Error: ${errorDetail}`);
    }

    console.log('Payment processed. Status:', paymentResult.status, 'ID:', paymentResult.id);

    return new Response(JSON.stringify(paymentResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Payment Processing Exception:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
