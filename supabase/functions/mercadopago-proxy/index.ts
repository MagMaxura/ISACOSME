
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v35 - Dynamic Domains)');

Deno.serve(async (req: Request) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { items, payer: rawPayer, external_reference, back_url } = body;

    // --- LOGS DETALLADOS PARA SEGURIDAD Y DEBUG ---
    console.log('------------------------------------------------');
    console.log('>>> [PROXY] Solicitud de Preferencia Recibida');
    console.log(`>>> [PROXY] External Reference (ID Venta): ${external_reference}`);
    console.log(`>>> [PROXY] Payer Email: ${rawPayer?.email}`);
    
    if (!items || items.length === 0) {
        console.error('>>> [PROXY] Error: El carrito está vacío.');
        throw new Error('El carrito está vacío.');
    }
    
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    
    // Determinamos la URL de retorno dinámicamente
    // 1. Usamos la enviada explícitamente desde el frontend (back_url)
    // 2. Si no existe, intentamos usar el header 'origin'
    // 3. Fallback a la URL principal por defecto
    const appUrl = back_url || req.headers.get('origin') || 'https://www.isabelladelaperla.app';
    
    console.log(`>>> [PROXY] Return URL configured to: ${appUrl}`);

    if (!accessToken) {
        console.error('>>> [PROXY] CRITICAL: MP_ACCESS_TOKEN no configurado.');
        throw new Error('Error de configuración del servidor.');
    }

    // Limpieza y validación de datos
    let email = rawPayer?.email || 'cliente@anonimo.com';
    if (!email.includes('@')) email = 'cliente@anonimo.com';

    // Aseguramos tipos correctos para la API de MP
    const cleanItems = items.map((item: any) => ({
        id: String(item.id).substring(0, 250),
        title: String(item.title).substring(0, 250),
        description: String(item.description || item.title).substring(0, 250),
        category_id: "beauty_and_personal_care",
        quantity: Math.max(1, Math.floor(Number(item.quantity))),
        unit_price: Number(Number(item.unit_price).toFixed(2)),
        currency_id: 'ARS'
    }));

    const reqUrl = new URL(req.url);
    const webhookUrl = `${reqUrl.origin}/functions/v1/mercadopago-webhook`;

    // Construcción del Payload para MP
    const preferencePayload = {
      items: cleanItems,
      external_reference: external_reference,
      payer: {
        name: rawPayer?.name || 'Cliente',
        surname: rawPayer?.surname || 'Web',
        email: email,
        date_created: new Date().toISOString(),
        phone: rawPayer?.phone ? { area_code: "", number: String(rawPayer.phone) } : undefined,
        address: {
            zip_code: rawPayer?.zip_code,
            street_name: rawPayer?.street_name,
            street_number: Number(rawPayer?.street_number) || undefined
        }
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-success` 
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
      statement_descriptor: "ISABELLA PERLA",
      binary_mode: false, // Permite pagos offline (Rapipago, etc.)
      expires: false,
    };

    console.log('>>> [PROXY] Enviando Payload a Mercado Pago:', JSON.stringify(preferencePayload, null, 2));

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
        console.error('>>> [PROXY] Error respuesta Mercado Pago:', response.status);
        console.error('>>> [PROXY] Detalle Error MP:', JSON.stringify(mpData, null, 2));
        throw new Error(mpData.message || 'Mercado Pago rechazó la generación del link.');
    }

    console.log('>>> [PROXY] Preferencia creada exitosamente.');
    console.log(`>>> [PROXY] Preference ID: ${mpData.id}`);
    console.log(`>>> [PROXY] Init Point: ${mpData.init_point}`);
    console.log('------------------------------------------------');

    return new Response(JSON.stringify({ init_point: mpData.init_point, id: mpData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error(">>> [PROXY] Excepción no controlada:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
