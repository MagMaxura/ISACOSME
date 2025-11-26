import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Mercado Pago Proxy function initialized (v25 - ROBUST MODE)');

// Helper seguro para parsear teléfonos. Si falla, devuelve valores por defecto seguros.
function safeParsePhone(phoneString: string) {
  try {
    if (!phoneString || phoneString.trim().length < 6) {
        // Return a safe default if phone is missing or too short
        return { area_code: '11', number: '11111111' };
    }
    
    // Keep only digits
    let clean = phoneString.replace(/\D/g, '');
    
    // Basic cleanup of country codes
    if (clean.startsWith('549')) clean = clean.substring(3);
    else if (clean.startsWith('54')) clean = clean.substring(2);
    if (clean.startsWith('0')) clean = clean.substring(1); // Remove leading zero like 011...

    let area_code = '11';
    let number = clean;

    // Intentar separar código de área si la longitud es lógica (10 dígitos en total)
    if (clean.length === 10) {
       if (clean.startsWith('11')) {
           area_code = '11';
           number = clean.substring(2);
       } else {
           // Asumir formato interior (4 digitos area + 6 numero aprox, simplificado)
           area_code = clean.substring(0, 3);
           number = clean.substring(3);
       }
    } else if (clean.length > 10) {
        // Si es muy largo, cortamos
        number = clean.substring(clean.length - 8);
    }

    return { area_code, number };
  } catch (e) {
    console.error("Error parsing phone, using default:", e);
    return { area_code: '11', number: '11111111' };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { items, payer: rawPayer, external_reference } = await req.json();

    console.log('Creating Preference. Sale ID:', external_reference);

    if (!items || items.length === 0) throw new Error('El carrito está vacío.');
    if (!rawPayer) throw new Error('Faltan datos del cliente.');

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const appUrl = 'https://www.isabelladelaperla.app'; 

    if (!accessToken) throw new Error('Configuración de servidor incompleta (Falta Token MP).');

    // --- ROBUST DATA SANITIZATION ---
    
    // 1. Phone: Never fail, fall back to defaults
    const parsedPhone = safeParsePhone(rawPayer.phone?.number);

    // 2. ID: Clean non-digits
    const rawIdNumber = String(rawPayer.identification?.number || '11111111').replace(/\D/g, '');
    const idType = rawIdNumber.length > 9 ? 'CUIT' : 'DNI'; // Simple heuristic

    // 3. Address: Handle missing/invalid numbers gracefully
    let streetNumber = parseInt(rawPayer.address?.street_number, 10);
    if (isNaN(streetNumber) || streetNumber <= 0) {
        streetNumber = 1; // Default to 1 if invalid
    }
    const streetName = rawPayer.address?.street_name || 'Calle';
    const zipCode = rawPayer.address?.zip_code || '1000';

    // 4. Items: Ensure prices are numbers with 2 decimals max to prevent math errors
    const cleanItems = items.map((item: any) => ({
        id: String(item.id),
        title: String(item.title).substring(0, 255), // MP limit
        quantity: Math.max(1, parseInt(item.quantity)), // Ensure integer >= 1
        unit_price: Number(Number(item.unit_price).toFixed(2)), // Force 2 decimals
        currency_id: 'ARS'
    }));

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || 'qlsyymuldzoyiazyzxlf.supabase.co';
    const notification_url = `${proto}://${host}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: cleanItems,
      external_reference: external_reference,
      payer: {
        name: rawPayer.name || 'Cliente',
        surname: rawPayer.surname || 'Web',
        email: rawPayer.email || 'no-email@example.com',
        phone: { 
            area_code: parsedPhone.area_code, 
            number: parsedPhone.number 
        },
        identification: { type: idType, number: rawIdNumber },
        address: {
          street_name: streetName,
          street_number: streetNumber,
          zip_code: zipCode
        }
      },
      back_urls: {
        success: `${appUrl}/#/payment-success`,
        failure: `${appUrl}/#/payment-failure`,
        pending: `${appUrl}/#/payment-failure`
      },
      auto_return: 'approved',
      notification_url: notification_url,
      statement_descriptor: "ISABELLA DE LA PERLA",
      binary_mode: false // Allows pending payments (e.g. PagoFacil)
    };

    console.log('Sending Sanitized Preference to MP:', JSON.stringify(preference));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error('MP API Error:', data);
        // Return a friendly error even if MP fails
        throw new Error(data.message || 'No se pudo generar el link de pago. Verifique los datos.');
    }

    return new Response(JSON.stringify({ init_point: data.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});