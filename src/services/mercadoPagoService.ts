
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
 * Genera una preferencia de pago en Mercado Pago.
 * Estrategia: Datos Parciales de Alta Calidad.
 * Enviamos Email y Nombre (obligatorios para scoring de fraude) pero omitimos
 * dirección y teléfono (que causan errores de formato técnico).
 */
export const createPreference = async (orderItems: OrderItem[], payerInfo: PayerInfo, externalReference?: string, shippingCost?: number): Promise<string> => {
    const safeExternalReference = externalReference || 'NO_ID';
    
    console.log(`[${SERVICE_NAME}] Init preference. Sale ID: ${safeExternalReference}. Shipping: ${shippingCost}`);
    
    // Formatear items para MP
    const mpItems = orderItems.map(item => ({
        id: item.id,
        title: item.nombre,
        description: item.nombre, // MP Requiere descripción para mejorar aprobación
        quantity: Math.floor(item.quantity),
        unit_price: Number(item.unitPrice.toFixed(2)),
        currency_id: 'ARS', 
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
        });
    }

    // Reactivamos el envío de datos del Payer (Nombre, Apellido, Email)
    // El reporte de MP indica que el Email es OBLIGATORIO para mejorar la tasa de aprobación.
    const mpPayer = {
        name: payerInfo.name,
        surname: payerInfo.surname,
        email: payerInfo.email,
        // Seguimos omitiendo phone y address intencionalmente para evitar errores de validación de formato
        // que suelen bloquear la creación de la preferencia.
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
            } catch (e) { /* ignore */ }
            
            throw new Error(`Error al conectar con pasarela de pago: ${errorMessage}`);
        }

        if (!data || !data.init_point) {
            console.error(`[${SERVICE_NAME}] Respuesta inválida:`, data);
            throw new Error(data?.error || 'No se recibió el link de pago.');
        }
        
        console.log(`[${SERVICE_NAME}] Preferencia creada exitosamente.`);
        return data.init_point;

    } catch (err: any) {
        console.error(`[${SERVICE_NAME}] Excepción:`, err);
        throw err;
    }
};
