// supabase/functions/mercadopago-webhook/index.ts

// Declare Deno to prevent TypeScript errors in a non-Deno environment.
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Mercado Pago Webhook function initialized');

// Helper to format currency
const formatPrice = (price: number): string => {
  return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper to create the email HTML body
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
      <h1 style="color: #333;">Nuevo Pedido Recibido - #${paymentDetails.id}</h1>
      <p>Se ha recibido y aprobado un nuevo pedido a través de la tienda online.</p>
      
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
        Total del Pedido: ${formatPrice(paymentDetails.transaction_amount)}
      </p>

      <h2 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 24px;">Información del Comprador</h2>
      <p><strong>Nombre:</strong> ${payer.first_name || ''} ${payer.last_name || ''}</p>
      <p><strong>Email:</strong> ${payer.email}</p>
      <p><strong>Teléfono:</strong> ${payer.phone?.area_code || ''} ${payer.phone?.number || ''}</p>
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

    // We only care about payment updates for sending the confirmation email.
    if (body.action !== 'payment.updated') {
      console.log('Received non-payment.updated webhook, ignoring.');
      // It's important to return a 200 OK so Mercado Pago doesn't retry.
      return new Response('Webhook received and ignored.', { status: 200 });
    }

    const paymentId = body.data.id;
    console.log(`Received update for payment ID: ${paymentId}`);

    // --- Get secrets ---
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const orderPrepEmail = Deno.env.get('ORDER_PREP_EMAIL');

    if (!accessToken || !resendApiKey || !orderPrepEmail) {
      throw new Error('Missing environment variables for Mercado Pago or Resend.');
    }

    // --- Fetch full payment details from Mercado Pago ---
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!mpResponse.ok) {
      throw new Error(`Failed to fetch payment details from Mercado Pago. Status: ${mpResponse.status}`);
    }
    const paymentDetails = await mpResponse.json();

    // --- Check if payment is approved and send email ---
    if (paymentDetails.status === 'approved') {
      console.log(`Payment ${paymentId} is approved. Sending notification email.`);
      
      const emailHtml = createEmailHtml(paymentDetails);

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Ventas Online <ventas@isabelladelaperla.com>', // IMPORTANT: Replace with your verified domain in Resend
          to: [orderPrepEmail],
          subject: `Nuevo Pedido Aprobado - Orden #${paymentDetails.id}`,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        console.error('Failed to send email via Resend:', errorData);
        throw new Error('Payment was approved, but failed to send the notification email.');
      }

      console.log(`Email sent successfully for order ${paymentId}.`);
    } else {
      console.log(`Payment ${paymentId} status is '${paymentDetails.status}', not 'approved'. No email sent.`);
    }

    // Acknowledge receipt of the webhook to Mercado Pago
    return new Response('Webhook processed successfully.', { status: 200 });

  } catch (error) {
    console.error('Error in mercadopago-webhook:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Use 500 for server-side errors
    });
  }
});
