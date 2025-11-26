
// supabase/functions/mercadopago-webhook/index.ts

declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Webhook function initialized (v3 - Robust DB Update)');

const formatPrice = (price: number): string => {
  return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const createEmailHtml = (paymentDetails: any): string => {
  const payer = paymentDetails.payer;
  const items = paymentDetails.additional_info.items;
  const shipping = paymentDetails.shipments?.receiver_address;

  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.title}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(Number(item.unit_price))}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(Number(item.unit_price) * Number(item.quantity))}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h1 style="color: #8a5cf6;">Pago Aprobado - Orden #${paymentDetails.external_reference || 'N/A'}</h1>
      <p>Se ha recibido un pago exitoso a través de Mercado Pago.</p>
      <p><strong>ID de Pago MP:</strong> ${paymentDetails.id}</p>
      
      <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">Detalles del Pedido</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: left;">Producto</th>
            <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: center;">Cantidad</th>
            <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: right;">Precio Unit.</th>
            <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p style="text-align: right; font-size: 1.2em; font-weight: bold; margin-top: 16px;">
        Total Pagado: ${formatPrice(paymentDetails.transaction_amount)}
      </p>

      <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 24px;">Información del Comprador</h2>
      <p><strong>Nombre:</strong> ${payer.first_name || ''} ${payer.last_name || ''}</p>
      <p><strong>Email:</strong> ${payer.email}</p>
      <p><strong>DNI:</strong> ${payer.identification?.number || 'No especificado'}</p>
      
      <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 24px;">Dirección de Envío</h2>
      <p>
        ${shipping?.street_name || 'No especificado'} ${shipping?.street_number || ''}<br>
        ${shipping?.zip_code || ''}, ${shipping?.city_name || ''}<br>
        ${shipping?.state_name || ''}
      </p>
    </div>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Check for 'payment' topic or 'payment.created'/'payment.updated' actions
    if (body.topic !== 'payment' && body.type !== 'payment' && body.action !== 'payment.created' && body.action !== 'payment.updated') {
      return new Response('Ignored', { status: 200 });
    }

    const paymentId = body.data?.id || body.data?.id; 
    if (!paymentId) return new Response('No payment ID found', { status: 200 });

    console.log(`Processing payment ID: ${paymentId}`);

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const orderPrepEmail = Deno.env.get('ORDER_PREP_EMAIL');
    
    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!accessToken) throw new Error('Missing MP_ACCESS_TOKEN.');

    // Fetch payment details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!mpResponse.ok) {
      throw new Error(`Failed to fetch payment details. Status: ${mpResponse.status}`);
    }
    const paymentDetails = await mpResponse.json();

    if (paymentDetails.status === 'approved') {
      console.log(`Payment ${paymentId} approved. Order ID (ext_ref): ${paymentDetails.external_reference}`);

      // 1. Update Database (Prioritized)
      if (paymentDetails.external_reference) {
        const { error: dbError } = await supabase
          .from('ventas')
          .update({ 
            estado: 'Pagada', 
            observaciones: `Pagado vía Mercado Pago (ID: ${paymentId}).` 
          })
          .eq('id', paymentDetails.external_reference);
          
        if (dbError) {
            console.error('Error updating database:', dbError);
        } else {
            console.log('Database updated successfully to Pagada.');
        }
      } else {
          console.warn('No external_reference (Sale ID) found in payment details. Cannot update DB.');
      }

      // 2. Send Email (Secondary, wrapped in try/catch so failure doesn't obscure DB success)
      if (resendApiKey && orderPrepEmail) {
        try {
            const emailHtml = createEmailHtml(paymentDetails);
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: 'Ventas Online <onboarding@resend.dev>',
                to: [orderPrepEmail],
                subject: `Nuevo Pedido Aprobado - Orden #${paymentDetails.external_reference?.substring(0,8) || 'N/A'}`,
                html: emailHtml,
              }),
            });
            if (!emailRes.ok) console.error('Resend API Error:', await emailRes.text());
            else console.log('Email notification sent.');
        } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
        }
      }
    }

    return new Response('Webhook processed', { status: 200 });

  } catch (error) {
    console.error('Error in mercadopago-webhook:', error.message);
    // Return 200 even on error to prevent MP from retrying indefinitely if it's a logic error
    // Log the error to Supabase logs for debugging
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
}, { verify: false });