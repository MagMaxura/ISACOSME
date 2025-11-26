import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const createEmailHtml = (paymentDetails: any) => {
  const payer = paymentDetails.payer;
  const items = paymentDetails.additional_info.items;
  const shipping = paymentDetails.shipments?.receiver_address;
  
  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${item.title}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${formatPrice(Number(item.unit_price))}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${formatPrice(Number(item.unit_price) * Number(item.quantity))}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
      <h1 style="color:#8a5cf6;">Nuevo Pedido Aprobado</h1>
      <p><strong>Orden ID:</strong> ${paymentDetails.external_reference || 'N/A'}</p>
      <p><strong>Pago ID:</strong> ${paymentDetails.id}</p>
      <h3 style="border-bottom:2px solid #eee;">Detalles</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;">Prod</th><th>Cant</th><th>Precio</th><th>Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="text-align:right;font-weight:bold;font-size:1.2em;">Total: ${formatPrice(paymentDetails.transaction_amount)}</p>
      <h3 style="border-bottom:2px solid #eee;">Datos Cliente</h3>
      <p>${payer.first_name} ${payer.last_name} (${payer.email}) - DNI: ${payer.identification?.number}</p>
      <p><strong>Envío:</strong> ${shipping?.street_name} ${shipping?.street_number}, CP ${shipping?.zip_code}</p>
    </div>`;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    // MP sends 'action' for payment creation/updates, or we check topic/type
    if (body.topic !== 'payment' && body.type !== 'payment' && body.action !== 'payment.created' && body.action !== 'payment.updated') {
      return new Response('Ignored', { status: 200 });
    }

    const paymentId = body.data?.id || body.data?.id; // MP format varies slightly
    if (!paymentId) return new Response('No payment ID found', { status: 200 });

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const orderPrepEmail = Deno.env.get('ORDER_PREP_EMAIL');
    
    // Initialize Admin Client to update database
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Payment Details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!mpResponse.ok) throw new Error('Error fetching MP payment');
    const paymentDetails = await mpResponse.json();

    if (paymentDetails.status === 'approved') {
      console.log(`Payment ${paymentId} approved. Order ID: ${paymentDetails.external_reference}`);

      // 1. Update Database
      if (paymentDetails.external_reference && paymentDetails.external_reference !== 'NO_ID') {
        const { error: dbError } = await supabase
          .from('ventas')
          .update({ 
            estado: 'Pagada', 
            observaciones: `Pagado vía MP (ID: ${paymentId})` 
          })
          .eq('id', paymentDetails.external_reference);
          
        if (dbError) console.error('Error updating database:', dbError);
        else console.log('Database updated successfully.');
      }

      // 2. Send Email
      if (resendApiKey && orderPrepEmail) {
        try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
              body: JSON.stringify({
                from: 'Ventas Online <onboarding@resend.dev>',
                to: [orderPrepEmail],
                subject: `Nueva Venta Web - Orden #${paymentDetails.external_reference?.substring(0,8)}`,
                html: createEmailHtml(paymentDetails)
              })
            });
            console.log('Email sent.');
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }
      }
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}, { verify: false });