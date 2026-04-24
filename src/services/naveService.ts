import { supabase } from '../supabase';
import { OrderItem } from '@/types';

const SERVICE_NAME = 'NaveService';

interface PayerInfo {
  name: string;
  surname: string;
  email: string;
  phone?: string; 
  dni?: string;
  street_name?: string;
  street_number?: string;
  zip_code?: string;
  city?: string;
  province?: string;
}

/**
 * Crea una intención de pago en NAVE a través de una Edge Function.
 * Retorna la checkout_url para redireccionar al usuario.
 */
export const createNavePayment = async (
    orderItems: OrderItem[], 
    payerInfo: PayerInfo, 
    saleId: string, 
    shippingCost: number = 0
): Promise<string> => {
    try {
        const { data, error } = await supabase.functions.invoke('nave-process-payment', {
            body: { 
                items: orderItems.map(item => ({
                    id: item.id,
                    name: item.nombre,
                    quantity: Math.floor(item.quantity),
                    unit_price: item.unitPrice
                })), 
                payer: {
                    ...payerInfo,
                    full_name: `${payerInfo.name} ${payerInfo.surname}`
                },
                external_payment_id: saleId,
                shipping_cost: shippingCost
            },
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Error en Edge Function:`, error);
            throw new Error(`Error al conectar con Nave: ${error.message}`);
        }

        if (!data || !data.checkout_url) {
            throw new Error(data?.error || 'No se recibió el link de pago de Nave.');
        }
        
        return data.checkout_url;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] Excepción:`, err);
        throw err;
    }
};
