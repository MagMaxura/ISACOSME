
import { supabase } from '@/supabase';
import { Insumo } from '@/types';
import { PostgrestError } from '@supabase/supabase-js';

const SERVICE_NAME = 'InsumosService';

const handleSupabaseError = (error: any, context: string) => {
    console.error(`[${SERVICE_NAME}] Error in ${context}:`, error);
    if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
        throw new Error(`Error de permisos (RLS) en '${context}'. Por favor, revisa las políticas de seguridad.`);
    }
    throw new Error(`Ocurrió un error en '${context}': ${error?.message}`);
};

export const fetchInsumos = async (): Promise<Insumo[]> => {
    try {
        console.log(`[${SERVICE_NAME}] Fetching insumos data.`);
        const { data, error } = await supabase
            .from('insumos')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        const insumos = data || [];
        console.log(`[${SERVICE_NAME}] Successfully fetched ${insumos.length} insumos.`);
        return insumos;
    } catch (error: any) {
        handleSupabaseError(error, 'fetchInsumos');
        return []; // for type safety, though handleSupabaseError throws
    }
};

export const fetchInsumoWithDetails = async (insumoId: string): Promise<{ insumo: Insumo; productoIds: string[] }> => {
    try {
        console.log(`[${SERVICE_NAME}] Fetching details for insumo ID: ${insumoId}`);
        const { data, error } = await (supabase
            .from('insumos') as any)
            .select(`*, productos_insumos(producto_id)`)
            .eq('id', insumoId)
            .single();

        if (error) throw error;

        const insumo: Insumo = data;
        const productoIds = (data.productos_insumos as any[] || []).map(link => link.producto_id);
        
        console.log(`[${SERVICE_NAME}] Successfully fetched details for insumo '${insumo.nombre}'.`);
        return { insumo, productoIds };

    } catch (error: any) {
        handleSupabaseError(error, `fetchInsumoWithDetails (id: ${insumoId})`);
        throw error; // rethrow after handling
    }
};

export const createInsumo = async (
    insumoData: Partial<Insumo>,
    productoIds: string[]
): Promise<Insumo> => {
    try {
        console.log(`[${SERVICE_NAME}] Creating new insumo: ${insumoData.nombre}`);
        const { data: newInsumo, error: insumoError } = await (supabase
            .from('insumos') as any)
            .insert([{
                nombre: insumoData.nombre,
                proveedor: insumoData.proveedor || null,
                ultimo_lote_pedido: insumoData.ultimo_lote_pedido || null,
                categoria: insumoData.categoria,
                costo: insumoData.costo,
                stock: insumoData.stock,
                unidad: insumoData.unidad,
                ultima_compra: insumoData.ultima_compra || null,
            }])
            .select()
            .single();
        
        if (insumoError) throw insumoError;
        
        console.log(`[${SERVICE_NAME}] Insumo created with ID: ${newInsumo.id}`);

        if (productoIds.length > 0) {
            const linksToCreate = productoIds.map(prodId => ({
                producto_id: prodId,
                insumo_id: newInsumo.id,
                cantidad: 1,
            }));
            const { error: linkError } = await (supabase.from('productos_insumos') as any).insert(linksToCreate);
            if (linkError) throw linkError;
        }
        return newInsumo;
    } catch (error: any) {
        handleSupabaseError(error, 'createInsumo');
        throw error;
    }
};

export const updateInsumo = async (
    insumoId: string,
    insumoData: Partial<Insumo>,
    productoIds: string[]
): Promise<Insumo> => {
    try {
        console.log(`[${SERVICE_NAME}] Updating insumo ID: ${insumoId}`);
        const { data: updatedInsumo, error: insumoError } = await (supabase
            .from('insumos') as any)
            .update({
                nombre: insumoData.nombre,
                proveedor: insumoData.proveedor || null,
                categoria: insumoData.categoria,
                costo: insumoData.costo,
                unidad: insumoData.unidad,
            })
            .eq('id', insumoId)
            .select()
            .single();
        
        if (insumoError) throw insumoError;

        const { error: deleteError } = await (supabase.from('productos_insumos') as any).delete().eq('insumo_id', insumoId);
        if (deleteError) throw deleteError;

        if (productoIds.length > 0) {
            const linksToCreate = productoIds.map(prodId => ({ producto_id: prodId, insumo_id: insumoId, cantidad: 1 }));
            const { error: linkError } = await supabase.from('productos_insumos').insert(linksToCreate as any);
            if (linkError) throw linkError;
        }
        return updatedInsumo;
    } catch (error: any) {
        handleSupabaseError(error, `updateInsumo (id: ${insumoId})`);
        throw error;
    }
};

interface StockUpdateData {
    insumoId: string;
    cantidad: number;
    costo: number;
    lote: string;
    fecha: string;
}

export const addStockToInsumo = async (stockData: StockUpdateData): Promise<void> => {
    try {
        console.log(`[${SERVICE_NAME}] Adding ${stockData.cantidad} units to insumo ID: ${stockData.insumoId}`);
        const { error } = await supabase.rpc('add_insumo_stock', {
            p_insumo_id: stockData.insumoId,
            p_cantidad_agregada: stockData.cantidad,
            p_nuevo_costo: stockData.costo,
            p_lote_comprado: stockData.lote,
            p_fecha_compra: stockData.fecha
        });
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] RPC call 'add_insumo_stock' failed:`, error);
         if (error.message?.includes('does not exist')) {
            throw new Error(`Error de base de datos: La función 'add_insumo_stock' no existe. Ejecuta el script SQL para crearla.`);
        }
        throw new Error(`No se pudo agregar stock: ${error?.message}`);
    }
};
