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

    // 2. Format payer info
    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        phone: {
            area_code: "54",
            number: payerInfo.phone,
        },
        identification: {
            type: "DNI",
            number: payerInfo.dni,
        },
        address: {
            street_name: payerInfo.street_name,
            street_number: parseInt(payerInfo.street_number, 10),
            zip_code: payerInfo.zip_code,
        },
    };

    try {
        // 3. Invoke the Supabase Edge Function
        // The function name is changed to match the deployed function from the user's image.
        const { data, error } = await supabase.functions.invoke('mercadopago-proxy', {
            body: { items: mpItems, payer: mpPayer },
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Supabase function invocation failed:`, error);
            if (error.message.includes('Function not found')) {
                 throw new Error('La función de pago en el servidor no está disponible. Contacta al administrador.');
            }
            // Try to parse the function's error message if available
            try {
                const functionError = JSON.parse(error.context.text);
                if(functionError.error) throw new Error(functionError.error);
            } catch(e) {
                // Do nothing if parsing fails, throw original error
            }
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