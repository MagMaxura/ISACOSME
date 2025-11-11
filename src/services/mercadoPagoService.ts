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
 * This is the secure way to handle payments, as the access token is never exposed to the client.
 *
 * @param {OrderItem[]} orderItems - The user's cart.
 * @param {PayerInfo} payerInfo - The guest user's contact and shipping information.
 * @returns {Promise<string>} The init_point URL from Mercado Pago to redirect the user to.
 */
export const createPreference = async (orderItems: OrderItem[], payerInfo: PayerInfo): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating payment preference.`);
    
    // 1. Format items for the Mercado Pago API
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: 'ARS', // Assuming Argentine Pesos
    }));

    // 2. Format payer info - The server will now handle cleaning and type inference for identification.
    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        phone: {
            // The server-side function will parse the area code and number from this string.
            number: payerInfo.phone,
        },
        identification: {
            // Send the raw number; the server will clean it and determine the type.
            number: payerInfo.dni,
        },
        address: {
            street_name: payerInfo.street_name,
            street_number: payerInfo.street_number, // Send as string, server will parse
            zip_code: payerInfo.zip_code,
        },
    };

    try {
        // 3. Invoke the Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('mercadopago-proxy', {
            body: { items: mpItems, payer: mpPayer },
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Supabase function invocation failed:`, error);
             
            // Check if it's an HTTP error with a parsable body from the Edge Function
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const functionError = await error.context.json();
                    if (functionError && functionError.error) {
                        // Throw a new error with the specific message from the function
                        throw new Error(functionError.error);
                    }
                } catch (e) {
                    console.error(`[${SERVICE_NAME}] Could not parse JSON error from function context`, e);
                    // Fall through to use the main error message
                }
            }
            
            // For network errors (like ERR_NAME_NOT_RESOLVED) or unparsable HTTP errors, use the main error message.
            throw new Error(`Error al contactar el servicio de pago: ${error.message}`);
        }

        // 4. Validate the response and return the payment URL
        if (!data || !data.init_point) {
            console.error(`[${SERVICE_NAME}] Invalid response from payment function:`, data);
            throw new Error(data.error || 'El servicio de pago no devolvió un link válido. Intenta de nuevo más tarde.');
        }
        
        console.log(`[${SERVICE_NAME}] Successfully created preference. Redirecting to Mercado Pago.`);
        return data.init_point;

    } catch (err: any) {
        // This will catch both invocation errors and validation errors from above.
        console.error(`[${SERVICE_NAME}] An exception occurred:`, err);
        throw err; // Re-throw to be handled by the UI component
    }
};