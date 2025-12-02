
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

console.log("Mercado Pago Webhook Initialized (v29 - Safe Config)");

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    
    // 1. Extract ID and Topic from Query Params OR Body
    // MP often sends ?id=...&topic=payment OR ?data.id=...&type=payment
    let id = url.searchParams.get('id') || url.searchParams.get('data.id');
    let topic = url.searchParams.get('topic') || url.searchParams.get('type');

    if (!id || !topic) {
        try {
            const body = await req.json();
            if (!id) id = body.data?.id || body.id;
            if (!topic) topic = body.type || body.topic || body.action;
            
            // Normalize v1 payment actions
            if (body.action === 'payment.created' || body.action === 'payment.updated') {
                topic = 'payment';
            }
        } catch (e) {
            // Body might be empty if it's just a ping or query param request
        }
    }

    console.log(`Webhook received. ID: ${id}, Topic: ${topic}`);

    // 2. Filter irrelevant events (Return 200 to stop MP from retrying)
    if (topic === 'merchant_order') {
        return new Response('Merchant Order Ignored', { status: 200 });
    }
    if (topic !== 'payment') {
        return new Response(`Event type '${topic}' ignored`, { status: 200 });
    }
    if (!id) {
        // If it's a test ping without ID, return OK
        return new Response('No ID found, ignoring', { status: 200 });
    }

    // 3. Verify REAL status with Mercado Pago API (Security)
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpToken) {
        console.error('Missing MP_ACCESS_TOKEN env var');
        return new Response('Server Config Error', { status: 500 });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
    });

    if (!mpRes.ok) {
        console.error(`Error verifying payment ${id} with MP API. Status: ${mpRes.status}`);
        // If MP returns 404, the payment doesn't exist, return 200 to stop retrying
        if(mpRes.status === 404) return new Response('Payment not found in MP', { status: 200 });
        return new Response('MP API Error', { status: 500 });
    }

    const paymentData = await mpRes.json();
    const status = paymentData.status;
    const saleId = paymentData.external_reference;

    console.log(`Payment ${id} verified. Status: ${status}. Sale ID: ${saleId}`);

    // 4. Update Database if Approved
    if (status === 'approved' && saleId && saleId !== 'NO_ID') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing DB Config');
            // Don't crash with 500, just log error so we can fix config, but tell MP we "processed" it to avoid infinite retries if config is broken
            return new Response('DB Config Error', { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('ventas')
            .update({ 
                estado: 'Pagada',
                observaciones: `Pagado vía MP (ID: ${id}) - ${new Date().toLocaleString('es-AR')}`
            })
            .eq('id', saleId);

        if (error) {
            console.error('Error updating DB:', error);
            return new Response('DB Update Failed', { status: 500 });
        }
        console.log('Sale updated to "Pagada" in DB.');
    } else {
        console.log('Payment not approved or missing Sale ID.');
    }

    return new Response('Webhook Processed', { status: 200 });

  } catch (err: any) {
    console.error('Webhook Critical Error:', err);
    // Return 200 even on error to prevent MP retry loops if it's a logic error on our end
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
