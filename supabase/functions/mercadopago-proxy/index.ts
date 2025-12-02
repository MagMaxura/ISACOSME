import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v30 - Minimalist Payload)');

Deno.serve(async (req: Request) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, payer: rawPayer, external_reference } = await req.json();

    console.log('Generando Preferencia Minimalista. Venta ID:', external_reference);

    if (!items || items.length === 0) throw new Error('El carrito está vacío.');
    
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    // URL base para retorno (frontend)
    const appUrl = 'https://www.isabelladelaperla.app'; 

    if (!accessToken) throw new Error('Falta configuración del servidor (Token MP).');

    // --- ESTRATEGIA MINIMALISTA ---
    // No enviamos teléfono, DNI ni dirección a Mercado Pago para evitar errores de validación
    // o bloqueos por inconsistencia de datos anti-fraude.
    // Ya tenemos los datos reales guardados en nuestra base de datos.
    
    let email = rawPayer?.email || 'cliente@anonimo.com';
    if (!email.includes('@')) email = 'cliente@anonimo.com';

    // Limpieza estricta de items (esto sí es obligatorio que esté bien)
    const cleanItems = items.map((item: any) => ({
        id: String(item.id).substring(0, 250),
        title: String(item.title).substring(0, 250),
        quantity: Math.max(1, Math.floor(Number(item.quantity))), // Entero positivo
        unit_price: Number(Number(item.unit_price).toFixed(2)), // Máx 2 decimales
        currency_id: 'ARS'
    }));

    // Detectar URL del webhook dinámicamente
    const reqUrl = new URL(req.url);
    const webhookUrl = `${reqUrl.origin}/functions/v1/mercadopago-webhook`;

    const preferencePayload = {
      items: cleanItems,
      external_reference: external_reference, // ID de la venta en nuestra DB
      payer: {
        email: email,
        // NO enviar name, surname, phone, address, identification.
        // Dejar que MP los pida o los infiera del usuario logueado.
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-failure`
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
      statement_descriptor: "ISABELLA PERLA",
      binary_mode: false // Permitir pagos pendientes (Rapipago, PagoFácil)
    };

    console.log('Payload enviado a MP:', JSON.stringify(preferencePayload));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preferencePayload)
    });

    const mpData = await response.json();
    
    if (!response.ok) {
        console.error('Error MP:', mpData);
        throw new Error(mpData.message || 'Mercado Pago rechazó la generación del link.');
    }

    return new Response(JSON.stringify({ init_point: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Error en Proxy:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});