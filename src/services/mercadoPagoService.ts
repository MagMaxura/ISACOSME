
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
    
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        quantity: item.quantity,
        unit_price: item.unitPrice,
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
                external_reference: externalReference // CRITICAL: Send Sale ID to link payment
            },
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Supabase function invocation failed:`, error);
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const functionError = await error.context.json();
                    if (functionError && functionError.error) throw new Error(functionError.error);
                } catch (e) { console.error(e); }
            }
            throw new Error(`Error al contactar el servicio de pago: ${error.message}`);
        }

        if (!data || !data.init_point) {
            console.error(`[${SERVICE_NAME}] Invalid response from payment function:`, data);
            throw new Error(data.error || 'El servicio de pago no devolvió un link válido. Intenta de nuevo más tarde.');
        }
        
        console.log(`[${SERVICE_NAME}] Successfully created preference. Redirecting to Mercado Pago.`);
        return data.init_point;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] An exception occurred:`, err);
        throw err;
    }
};
