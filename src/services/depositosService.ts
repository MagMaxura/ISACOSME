

import { supabase } from '../supabase';
import { Deposito, TransferenciaStock } from '../types';

const SERVICE_NAME = 'DepositosService';

export const fetchDepositos = async (): Promise<Deposito[]> => {
    console.log(`[${SERVICE_NAME}] Fetching depositos.`);
    try {
        const { data, error } = await supabase
            .from('depositos')
            .select('*')
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching depositos:`, error);
        throw new Error(`No se pudieron cargar los depósitos: ${error.message}`);
    }
};

export const createDeposito = async (depositoData: Partial<Deposito>): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Creating new deposito: ${depositoData.nombre}`);
    try {
        // If this one is default, make sure no others are
        if (depositoData.es_predeterminado) {
            const { error: updateError } = await (supabase.from('depositos') as any).update({ es_predeterminado: false }).eq('es_predeterminado', true);
            if (updateError) throw updateError;
        }

        const { error } = await (supabase.from('depositos') as any).insert([
            {
                nombre: depositoData.nombre,
                direccion: depositoData.direccion,
                es_predeterminado: depositoData.es_predeterminado
            }
        ]);
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating deposito:`, error);
        if (error.message?.includes('un_solo_predeterminado_idx')) {
            throw new Error('Ya existe un depósito predeterminado. Por favor, desmarque el actual antes de asignar uno nuevo.');
        }
        throw new Error(`No se pudo crear el depósito: ${error.message}`);
    }
};

export const updateDeposito = async (id: string, depositoData: Partial<Deposito>): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Updating deposito: ${id}`);
    try {
        if (depositoData.es_predeterminado) {
            const { error: updateError } = await (supabase.from('depositos') as any).update({ es_predeterminado: false }).eq('es_predeterminado', true);
            if (updateError) throw updateError;
        }

        const { error } = await (supabase.from('depositos') as any).update({
            nombre: depositoData.nombre,
            direccion: depositoData.direccion,
            es_predeterminado: depositoData.es_predeterminado
        }).eq('id', id);
        
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error updating deposito:`, error);
        if (error.message?.includes('un_solo_predeterminado_idx')) {
            throw new Error('Ya existe otro depósito predeterminado. Por favor, desmarque el actual antes de asignar este.');
        }
        throw new Error(`No se pudo actualizar el depósito: ${error.message}`);
    }
};

export const deleteDeposito = async (id: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Deleting deposito: ${id}`);
    try {
        const { error } = await supabase.from('depositos').delete().eq('id', id);
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error deleting deposito:`, error);
        throw new Error(`No se pudo eliminar el depósito: ${error.message}`);
    }
};

export const transferirStock = async (loteId: string, depositoDestinoId: string, cantidad: number): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Transferring ${cantidad} from lot ${loteId} to deposit ${depositoDestinoId}`);
    try {
        // Using `any` on `supabase.rpc` is a targeted workaround for a known Supabase/TypeScript issue
        // ("Type instantiation is excessively deep") that can occur with complex schemas and RPC calls.
        // It bypasses the complex type inference that causes the error, without affecting runtime behavior.
        const { error } = await (supabase.rpc as any)('transferir_stock', {
            p_lote_id: loteId,
            p_deposito_destino_id: depositoDestinoId,
            p_cantidad: cantidad,
        });

        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error in RPC transferir_stock:`, error);
        throw new Error(`No se pudo realizar la transferencia: ${error.message}`);
    }
};

export const fetchTransferencias = async (): Promise<TransferenciaStock[]> => {
    console.log(`[${SERVICE_NAME}] Fetching transfer history via RPC.`);
    try {
        // Using `any` on `supabase.rpc` is a targeted workaround for the "Type instantiation is excessively deep"
        // TypeScript error that can occur with complex schemas and RPC calls.
        const { data, error } = await (supabase.rpc as any)('get_historial_transferencias', {});

        if (error) throw error;
        
        // The RPC can return null, and with an <any> schema, data is 'unknown'.
        // We cast it to the expected array type to safely use .map.
        const transferenciasData = data as unknown as any[];
        
        return (transferenciasData || []).map((t: any) => ({
            id: t.id,
            fecha: new Date(t.fecha).toLocaleString('es-AR'),
            cantidad: t.cantidad,
            notas: t.notas,
            productoNombre: t.producto_nombre || 'N/A',
            depositoOrigenNombre: t.deposito_origen_nombre || 'N/A',
            depositoDestinoNombre: t.deposito_destino_nombre || 'N/A',
            usuarioEmail: t.usuario_email || 'N/A',
        }));

    } catch (error: any) {
        // Log the full error object for better debugging in the developer console
        console.error(`[${SERVICE_NAME}] Full error object from RPC 'get_historial_transferencias':`, JSON.stringify(error, null, 2));
        
        // Create a more informative error message for the UI's error display component
        let userMessage = `No se pudo cargar el historial de transferencias.`;
        if (error.message) {
            userMessage += ` Detalles: ${error.message}`;
        }
        if (error.hint) {
            userMessage += ` Sugerencia: ${error.hint}`;
        }
        // Check for a specific PostgreSQL error code for "function does not exist"
        if (error.code === '42883') {
             userMessage = `Error de base de datos: La función 'get_historial_transferencias' no se encontró. Por favor, asegúrate de haber ejecutado el script SQL proporcionado para crear esta función y sus permisos.`;
        }
        
        throw new Error(userMessage);
    }
}