
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Mercado Pago Process Payment Function Initialized (v15 - Safe Mode)");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { formData, external_reference, payerInfo, items } = await req.json();
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (!accessToken) throw new Error('Server config error: Missing MP Token');

    console.log(`Processing payment for Sale ID: ${external_reference}. Type: ${formData.payment_type_id}`);

    // --- Data Sanitization & Enrichment ---
    
    // 1. Phone Parsing
    let cleanPhone = payerInfo.phone ? String(payerInfo.phone).replace(/\D/g, '') : "";
    let areaCode = "";
    let phoneNumber = cleanPhone;
    
    if (cleanPhone.length >= 10) {
       areaCode = cleanPhone.substring(0, cleanPhone.length - 7); 
       phoneNumber = cleanPhone.substring(cleanPhone.length - 7);
    }

    const cleanStreetNumber = payerInfo.street_number ? (parseInt(String(payerInfo.street_number).replace(/\D/g, ''), 10) || 0) : 0;
    
    // 2. Installments Logic
    let installments = formData.installments ? Math.floor(Number(formData.installments)) : 1;
    if (formData.payment_type_id === 'debit_card' || formData.payment_type_id === 'prepaid_card') {
        installments = 1;
    }

    // 3. Binary Mode Strategy
    // We set this to false to allow 'in_process' status.
    // This prevents immediate rejections for 'high_risk' and allows manual review.
    const binaryMode = false;

    // 4. Strict Payer Identification
    // We prioritize the data from the explicit form (payerInfo) over the Brick's data
    const identificationNumber = String(payerInfo.dni).replace(/\D/g, '');
    const identification = {
        type: 'DNI',
        number: identificationNumber
    };

    console.log(`Using Payer: ${payerInfo.name} ${payerInfo.surname} (DNI: ${identificationNumber})`);

    // Build the robust payload
    const paymentBody = {
        token: formData.token,
        issuer_id: formData.issuer_id,
        payment_method_id: formData.payment_method_id,
        transaction_amount: Number(formData.transaction_amount),
        installments: installments,
        payer: {
            email: payerInfo.email, // Force email from form
            identification: identification, // Force DNI from form
            first_name: payerInfo.name, // Force Name from form
            last_name: payerInfo.surname, // Force Surname from form
            entity_type: 'individual'
        },
        external_reference: external_reference,
        statement_descriptor: "ISABELLA PERLA",
        description: `Pedido ${external_reference.substring(0,8)}`,
        binary_mode: binaryMode, 
        additional_info: {
            ip_address: "127.0.0.1", 
            items: items ? items.map((i: any) => ({
                id: String(i.id),
                title: i.nombre,
                description: i.nombre, 
                category_id: "beauty_and_personal_care",
                quantity: Math.floor(Number(i.quantity)),
                unit_price: Number(Number(i.unitPrice).toFixed(2))
            })) : [],
            payer: {
                first_name: payerInfo.name,
                last_name: payerInfo.surname,
                phone: {
                    area_code: areaCode, 
                    number: phoneNumber 
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

    // --- DEEP LOGGING ---
    console.log("----- PAYLOAD (Binary Mode: " + binaryMode + ") -----");
    const logBody = { ...paymentBody, token: '***MASKED***' };
    console.log(JSON.stringify(logBody, null, 2));

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

    console.log(`Result: ${paymentResult.status} | Detail: ${paymentResult.status_detail}`);

    return new Response(JSON.stringify(paymentResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Payment Exception:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
