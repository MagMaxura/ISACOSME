import { supabase } from '../supabase';
import { OrderItem } from '@/components/CheckoutModal';

const SERVICE_NAME = 'MercadoPagoService';

interface PayerInfo {
  name: string;
  surname: string;
  email: string;
  phone: string;
  dni: string;
  street_name: string;
  street_number: string;
  zip_code: string;
  city: string;
  province: string;
}

/**
 * Creates a Mercado Pago payment preference by invoking a Supabase Edge Function.
 *
 * @param {OrderItem[]} orderItems - The user's cart.
 * @param {PayerInfo} payerInfo - The guest user's contact and shipping information.
 * @param {string} [externalReference] - The internal Sale ID to link the payment to.
 * @param {number} [shippingCost] - The shipping cost to be added as a line item.
 * @returns {Promise<string>} The init_point URL from Mercado Pago.
 */
export const createPreference = async (orderItems: OrderItem[], payerInfo: PayerInfo, externalReference?: string, shippingCost?: number): Promise<string> => {
    // Ensure externalReference is a string to prevent JSON parsing issues on the server
    const safeExternalReference = externalReference || 'NO_ID';
    
    console.log(`[${SERVICE_NAME}] Creating payment preference. Sale ID: ${safeExternalReference}. Shipping: ${shippingCost}`);
    
    // Pre-formatting items to be extra safe
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        quantity: Math.floor(item.quantity), // Ensure integer
        unit_price: Number(item.unitPrice.toFixed(2)), // Ensure 2 decimals max
        currency_id: 'ARS', 
    }));

    // Add shipping as a separate item if applicable
    if (shippingCost && shippingCost > 0) {
        mpItems.push({
            id: 'shipping',
            title: 'Costo de Envío',
            quantity: 1,
            unit_price: Number(shippingCost.toFixed(2)),
            currency_id: 'ARS',
        });
    }

    // ESTRATEGIA MINIMALISTA (FIX "No pudimos procesar tu pago"):
    // Solo enviamos nombre, apellido y email.
    // Omitimos intencionalmente teléfono, DNI y dirección. 
    // Mercado Pago valida estos campos de forma muy estricta y a menudo rechaza pagos legítimos
    // si el formato no es perfecto o si no coinciden con la tarjeta.
    // Como ya guardamos los datos de envío en nuestra base de datos, no necesitamos arriesgarnos a enviarlos aquí.
    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        // phone: OMITIDO
        // identification: OMITIDO
        // address: OMITIDO
    };

    try {
        const { data, error } = await supabase.functions.invoke('mercadopago-proxy', {
            body: { 
                items: mpItems, 
                payer: mpPayer,
                external_reference: safeExternalReference
            },
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Supabase function invocation failed:`, error);
            // Try to parse the error message from the function if available
            let errorMessage = error.message;
            try {
                 if (error.context && typeof error.context.json === 'function') {
                    const functionError = await error.context.json();
                    if (functionError && functionError.error) errorMessage = functionError.error;
                 }
            } catch (e) { /* ignore */ }
            
            throw new Error(`Error de conexión con Mercado Pago: ${errorMessage}`);
        }

        if (!data || !data.init_point) {
            console.error(`[${SERVICE_NAME}] Invalid response from payment function:`, data);
            throw new Error(data?.error || 'El servicio de pago no devolvió un link válido.');
        }
        
        console.log(`[${SERVICE_NAME}] Preference created. Init Point: ${data.init_point}`);
        return data.init_point;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] An exception occurred:`, err);
        throw err;
    }
};