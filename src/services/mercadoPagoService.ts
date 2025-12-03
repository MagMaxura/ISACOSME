
import { supabase } from '../supabase';
import { OrderItem } from '@/components/CheckoutModal';

const SERVICE_NAME = 'MercadoPagoService';

interface PayerInfo {
  name: string;
  surname: string;
  email: string;
  phone?: string; 
  dni?: string;
  street_name?: string;
  street_number?: string;
  zip_code?: string;
}

/**
 * Genera una preferencia de pago en Mercado Pago (Checkout Pro).
 */
export const createPreference = async (orderItems: OrderItem[], payerInfo: PayerInfo, externalReference?: string, shippingCost?: number): Promise<string> => {
    const safeExternalReference = externalReference || 'NO_ID';
    
    console.log(`[${SERVICE_NAME}] Init preference. Sale ID: ${safeExternalReference}. Shipping: ${shippingCost}`);
    
    // Formatear items para el proxy
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        description: item.nombre, 
        quantity: Math.floor(item.quantity),
        unit_price: Number(item.unitPrice.toFixed(2)),
        currency_id: 'ARS', 
        picture_url: 'https://qlsyymuldzoyiazyzxlf.supabase.co/storage/v1/object/public/Isabella%20de%20la%20Perla/Isabella%20de%20la%20perla%20Logo%20completo.png'
    }));

    // Agregar envío como item si existe
    if (shippingCost && shippingCost > 0) {
        mpItems.push({
            id: 'shipping',
            title: 'Costo de Envío',
            description: 'Servicio de logística',
            quantity: 1,
            unit_price: Number(shippingCost.toFixed(2)),
            currency_id: 'ARS',
            picture_url: ''
        });
    }

    // Datos del Payer
    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        phone: payerInfo.phone,
        dni: payerInfo.dni,
        street_name: payerInfo.street_name,
        street_number: payerInfo.street_number,
        zip_code: payerInfo.zip_code
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
            console.error(`[${SERVICE_NAME}] Error en Edge Function:`, error);
            let errorMessage = error.message;
            try {
                 if (error.context && typeof error.context.json === 'function') {
                    const functionError = await error.context.json();
                    if (functionError && functionError.error) errorMessage = functionError.error;
                 }
            } catch (e) { /* ignore json parse error */ }
            
            throw new Error(`Error al conectar con pasarela de pago: ${errorMessage}`);
        }

        if (!data || !data.init_point) {
            console.error(`[${SERVICE_NAME}] Respuesta inválida:`, data);
            throw new Error(data?.error || 'No se recibió el link de pago.');
        }
        
        console.log(`[${SERVICE_NAME}] Preferencia creada exitosamente: ${data.init_point}`);
        return data.init_point;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] Excepción:`, err);
        throw err;
    }
};
