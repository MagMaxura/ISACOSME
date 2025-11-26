
// supabase/functions/mercadopago-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v21 - FIXED External Reference)');

function parseArgentinianPhoneNumber(phoneString: string) {
  if (!phoneString || phoneString.trim().length < 8) {
    throw new Error('El número de teléfono es demasiado corto.');
  }
  let clean = phoneString.replace(/\D/g, '');
  const originalNoSymbols = phoneString.replace(/[\s-()]/g, '');
  const isMobile = originalNoSymbols.startsWith('+549') || (originalNoSymbols.startsWith('15') && originalNoSymbols.length >= 8) || (clean.startsWith('9') && clean.length > 10);

  if (clean.startsWith('549')) clean = clean.substring(3);
  else if (clean.startsWith('54')) clean = clean.substring(2);
  if (clean.startsWith('9') && clean.length === 11) clean = clean.substring(1);
  if (clean.startsWith('0')) clean = clean.substring(1);

  let area_code = '';
  let number = '';

  if (clean.length === 10) {
    if (clean.startsWith('11')) {
      area_code = '11';
      number = clean.substring(2);
    } else if (['26','29','37','38'].some(prefix => clean.startsWith(prefix))) {
      area_code = clean.substring(0, 4);
      number = clean.substring(4);
    } else {
      area_code = clean.substring(0, 3);
      number = clean.substring(3);
    }
  } else if (clean.length === 8) {
    area_code = '11';
    number = clean;
  } else {
    throw new Error(`Teléfono inválido: ${phoneString}`);
  }

  if (number.startsWith('15')) number = number.substring(2);
  if (isMobile) number = '9' + number;

  return { area_code, number };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { items, payer: rawPayer, external_reference } = await req.json();

    console.log('Received external_reference (Sale ID):', external_reference);

    if (!items || !rawPayer) throw new Error('Faltan datos de items o del pagador.');

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const appUrl = 'https://www.isabelladelaperla.app'; 

    if (!accessToken) throw new Error('Falta MP_ACCESS_TOKEN.');

    const parsedPhone = parseArgentinianPhoneNumber(rawPayer.phone?.number || '');
    const rawIdNumber = String(rawPayer.identification?.number || '').replace(/\D/g, '');
    const idType = rawIdNumber.length === 11 ? 'CUIT' : 'DNI';
    const streetNumber = parseInt(rawPayer.address?.street_number, 10);

    if (isNaN(streetNumber) || streetNumber <= 0) throw new Error('Número de calle inválido.');

    const proto = req.headers.get('x-forwarded-proto');
    const host = req.headers.get('x-forwarded-host');
    const notification_url = `${proto}://${host}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: items,
      external_reference: external_reference, // LINKING PAYMENT TO ORDER ID
      payer: {
        name: rawPayer.name,
        surname: rawPayer.surname,
        email: rawPayer.email,
        phone: { area_code: parsedPhone.area_code, number: parsedPhone.number },
        identification: { type: idType, number: rawIdNumber },
        address: {
          street_name: rawPayer.address?.street_name,
          street_number: streetNumber,
          zip_code: rawPayer.address?.zip_code
        }
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-failure`
      },
      auto_return: 'approved',
      notification_url: notification_url,
      statement_descriptor: "ISABELLA DE LA PERLA"
    };

    console.log('Sending Preference to MP:', JSON.stringify(preference));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error al crear preferencia MP');

    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});