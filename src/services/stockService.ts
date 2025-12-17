import { supabase } from '../supabase';
import { Insumo, Lote } from '../types';

const SERVICE_NAME = 'StockService';

// Defining a local type for the function's return value
export type StockProducto = {
    id: string;
    nombre: string;
    codigoBarras: string | null;
    stock: number;
    lotes: Lote[];
};

export const fetchStockProductos = async (): Promise<StockProducto[]> => {
    console.log(`[${SERVICE_NAME}] Fetching product stock data.`);
    try {
        const { data: productosData, error: pError } = await supabase.from('productos').select('id, nombre, codigo_barras');
        if (pError) { (pError as any).table = 'productos'; throw pError; }

        const { data: lotesData, error: lError } = await supabase.from('lotes').select('*').order('fecha_vencimiento', { ascending: true, nullsFirst: false });
        if (lError) { (lError as any).table = 'lotes'; throw lError; }

        console.log(`[${SERVICE_NAME}] Successfully fetched ${productosData.length} products and ${lotesData.length} lots for stock calculation.`);

        const transformedProductos: StockProducto[] = productosData.map(p => {
            const productoLotes = lotesData.filter(l => l.producto_id === p.id);
            const stock = productoLotes.reduce((sum, lote) => sum + lote.cantidad_actual, 0);
            const uiLotes: Lote[] = productoLotes.map(l => ({
                id: l.id,
                numero_lote: l.numero_lote,
                cantidad_inicial: l.cantidad_inicial,
                cantidad_actual: l.cantidad_actual,
                fecha_vencimiento: l.fecha_vencimiento, // Keep as string from DB
                costo_laboratorio: l.costo_laboratorio,
                deposito_id: l.deposito_id,
            }));

            return {
                id: p.id,
                nombre: p.nombre,
                codigoBarras: p.codigo_barras,
                stock: stock,
                lotes: uiLotes,
            };
        });
        
        console.log(`[${SERVICE_NAME}] Stock product data transformation complete.`);
        return transformedProductos;
    } catch (error: any) {
        const tableName = error.table ? ` en la tabla '${error.table}'` : '';
        console.error(`[${SERVICE_NAME}] Error fetching stock productos${tableName}:`, error?.message);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS)${tableName}. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        throw error;
    }
};

/**
 * Fetches available lots directly from the 'lotes' table.
 * This bypasses aggregated views/RPCs to ensure we get the absolute latest stock state.
 */
export const fetchLotesParaVenta = async (productoId: string, depositoId?: string): Promise<Lote[]> => {
    console.log(`[${SERVICE_NAME}] Fetching raw lots for product ${productoId} ${depositoId ? `in deposit ${depositoId}` : ''}`);
    
    let query = supabase
        .from('lotes')
        .select('*')
        .eq('producto_id', productoId);

    if (depositoId) {
        query = query.eq('deposito_id', depositoId);
    }
    
    query = query.order('fecha_vencimiento', { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    
    if (error) {
        console.error(`[${SERVICE_NAME}] Error fetching lots for sale:`, error);
        throw error;
    }
    
    if (data) {
        console.log(`[${SERVICE_NAME}] DEBUG: DB returned ${data.length} lots. Exact values:`, 
            data.map(l => ({ id: l.id, lote: l.numero_lote, cant_raw: l.cantidad_actual }))
        );
    }
    
    return (data || []) as Lote[];
}

export interface ProductionData {
    productoId: string;
    cantidadProducida: number;
    numeroLote: string;
    fechaVencimiento: string;
    costoLaboratorio: number;
}

export const registerProduction = async (data: ProductionData): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Registering new production for product ID: ${data.productoId}`);
    
    const { error } = await supabase.rpc('registrar_produccion', {
        p_producto_id: data.productoId,
        p_cantidad_producida: data.cantidadProducida,
        p_numero_lote: data.numeroLote,
        p_fecha_vencimiento: data.fechaVencimiento ? data.fechaVencimiento : null,
        p_costo_laboratorio: data.costoLaboratorio
    });

    if (error) {
        console.error(`[${SERVICE_NAME}] RPC call 'registrar_produccion' failed:`, JSON.stringify(error, null, 2));
        
        const functionNotFound = error.code === '42883' || error.message?.includes('function registrar_produccion does not exist') || error.message?.includes('Could not find the function');
        if (functionNotFound) {
            throw {
                message: "Error de base de datos: La función 'registrar_produccion' no existe o está desactualizada.",
                details: "Esta función es necesaria para registrar la producción de nuevos lotes. La versión actual en la app soluciona un problema que impedía agregar stock a un lote ya existente.",
                hint: "Ejecuta el script SQL 'registrar_produccion' actualizado.",
                sql: `CREATE OR REPLACE FUNCTION registrar_produccion(
    p_producto_id uuid,
    p_cantidad_producida integer,
    p_numero_lote text,
    p_fecha_vencimiento date,
    p_costo_laboratorio numeric
)
RETURNS void AS $$
DECLARE
    v_deposito_id uuid;
BEGIN
    SELECT id INTO v_deposito_id FROM depositos WHERE es_predeterminado = TRUE LIMIT 1;
    IF v_deposito_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró un depósito predeterminado.';
    END IF;

    INSERT INTO lotes (producto_id, numero_lote, cantidad_inicial, cantidad_actual, fecha_vencimiento, costo_laboratorio, deposito_id)
    VALUES (p_producto_id, p_numero_lote, p_cantidad_producida, p_cantidad_producida, p_fecha_vencimiento, p_costo_laboratorio, v_deposito_id)
    ON CONFLICT (producto_id, numero_lote, deposito_id) DO UPDATE
    SET
        cantidad_inicial = lotes.cantidad_inicial + EXCLUDED.cantidad_inicial,
        cantidad_actual = lotes.cantidad_actual + EXCLUDED.cantidad_actual,
        fecha_vencimiento = GREATEST(lotes.fecha_vencimiento, EXCLUDED.fecha_vencimiento),
        costo_laboratorio = lotes.costo_laboratorio + EXCLUDED.costo_laboratorio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
            };
        }
        throw new Error(`Error al registrar la producción: ${error?.message}`);
    }

    console.log(`[${SERVICE_NAME}] Successfully registered production via RPC.`);
};

export interface UpdateProductionData {
    loteId: string;
    numeroLote: string;
    cantidadInicial: number;
    fechaVencimiento: string;
    costoLaboratorio: number;
}

export const updateProduction = async (data: UpdateProductionData): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Updating production for lot ID: ${data.loteId}`);

    const { error } = await supabase.rpc('modificar_produccion', {
        p_lote_id: data.loteId,
        p_nuevo_numero_lote: data.numeroLote,
        p_nueva_cantidad_inicial: data.cantidadInicial,
        p_nueva_fecha_vencimiento: data.fechaVencimiento ? data.fechaVencimiento : null,
        p_nuevo_costo_laboratorio: data.costoLaboratorio,
    });
    
    if (error) {
        console.error(`[${SERVICE_NAME}] RPC call 'modificar_produccion' failed:`, JSON.stringify(error, null, 2));
        throw new Error(`Error al modificar la producción: ${error?.message}`);
    }

    console.log(`[${SERVICE_NAME}] Successfully updated production via RPC.`);
};