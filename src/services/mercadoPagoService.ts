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
}

/**
 * Creates a Mercado Pago payment preference by invoking a Supabase Edge Function.
 *
 * @param {OrderItem[]} orderItems - The user's cart.
 * @param {PayerInfo} payerInfo - The guest user's contact and shipping information.
 * @param {string} [externalReference] - The internal Sale ID to link the payment to.
 * @returns {Promise<string>} The init_point URL from Mercado Pago.
 */
export const createPreference = async (orderItems: OrderItem[], payerInfo: PayerInfo, externalReference?: string): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating payment preference. Sale ID: ${externalReference}`);
    
    // Pre-formatting items to be extra safe
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        quantity: Math.floor(item.quantity), // Ensure integer
        unit_price: Number(item.unitPrice.toFixed(2)), // Ensure 2 decimals max
        currency_id: 'ARS', 
    }));

    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        phone: { number: payerInfo.phone },
        identification: { number: payerInfo.dni },
        address: {
            street_name: payerInfo.street_name,
            street_number: payerInfo.street_number, 
            zip_code: payerInfo.zip_code,
        },
    };

    try {
        const { data, error } = await supabase.functions.invoke('mercadopago-proxy', {
            body: { 
                items: mpItems, 
                payer: mpPayer,
                external_reference: externalReference || 'NO_ID' // Fallback if ID is missing
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
            throw new Error(data.error || 'El servicio de pago no devolvió un link válido.');
        }
        
        console.log(`[${SERVICE_NAME}] Preference created. Init Point: ${data.init_point}`);
        return data.init_point;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] An exception occurred:`, err);
        throw err;
    }
};