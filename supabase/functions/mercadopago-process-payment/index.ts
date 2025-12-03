
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Mercado Pago Process Payment Function Initialized (v8 - Deep Log & DNI Fallback)");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { formData, external_reference, payerInfo, items } = await req.json();
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (!accessToken) throw new Error('Server config error: Missing MP Token');

    console.log(`Processing payment for Sale ID: ${external_reference}. Type: ${formData.payment_type_id}`);

    // --- Data Sanitization ---
    const cleanPhone = payerInfo.phone ? String(payerInfo.phone).replace(/\D/g, '') : "";
    const cleanStreetNumber = payerInfo.street_number ? (parseInt(String(payerInfo.street_number).replace(/\D/g, ''), 10) || 0) : 0;
    
    // --- Identification Logic (DNI Fallback) ---
    // CRITICAL FIX: If the Brick doesn't provide identification (common in some configs), 
    // we use the DNI collected in the checkout form (payerInfo).
    let identification = formData.payer?.identification;
    if (!identification || !identification.number) {
        console.log("Brick did not provide identification. Using fallback from PayerInfo form.");
        identification = {
            type: 'DNI',
            number: String(payerInfo.dni).replace(/\D/g, '') // Ensure only digits
        };
    }

    // Build a robust payment payload
    const paymentBody = {
        token: formData.token,
        issuer_id: formData.issuer_id,
        payment_method_id: formData.payment_method_id,
        transaction_amount: Number(formData.transaction_amount),
        installments: Number(formData.installments),
        payer: {
            email: formData.payer.email || payerInfo.email,
            identification: identification, // Uses the robust/fallback identification
            first_name: payerInfo.name, // Moving name to root payer improves scoring
            last_name: payerInfo.surname
        },
        external_reference: external_reference,
        statement_descriptor: "ISABELLA PERLA",
        description: `Pedido Web ${external_reference}`,
        binary_mode: false, // FALSE allows "in_process" status instead of instant rejection. Better for high approval.
        additional_info: {
            items: items ? items.map((i: any) => ({
                id: String(i.id),
                title: i.nombre,
                description: i.nombre,
                quantity: Math.floor(Number(i.quantity)),
                unit_price: Number(Number(i.unitPrice).toFixed(2))
            })) : [],
            payer: {
                first_name: payerInfo.name,
                last_name: payerInfo.surname,
                phone: {
                    area_code: "", 
                    number: cleanPhone 
                },
                address: {
                    zip_code: payerInfo.zip_code,
                    street_name: payerInfo.street_name,
                    street_number: cleanStreetNumber
                }
            },
            shipments: {
                receiver_address: {
                    zip_code: payerInfo.zip_code,
                    street_name: payerInfo.street_name,
                    street_number: cleanStreetNumber,
                    floor: "",
                    apartment: ""
                }
            }
        }
    };

    // --- DEEP LOGGING FOR DEBUGGING ---
    console.log("----- DEBUG: PAYLOAD TO MERCADOPAGO -----");
    // Create a safe copy for logging (masking sensitive token)
    const logBody = { ...paymentBody, token: '***MASKED***' };
    console.log(JSON.stringify(logBody, null, 2));
    console.log("-----------------------------------------");

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

    console.log(`Payment processed. Status: ${paymentResult.status} | Detail: ${paymentResult.status_detail} | ID: ${paymentResult.id}`);

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
