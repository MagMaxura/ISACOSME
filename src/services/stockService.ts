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
        console.error(`[${SERVICE_NAME}] Error fetching stock productos${tableName}:`, error.message);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS)${tableName}. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        throw error;
    }
};

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
        if (error.message?.includes('lotes_numero_lote_producto_id_key')) {
             throw new Error(`El número de lote "${data.numeroLote}" ya existe para este producto. Por favor, elige un número de lote único.`);
        }
        throw new Error(`Error al registrar la producción: ${error.message}`);
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
         if (error.message?.includes('lotes_numero_lote_producto_id_key')) {
             throw new Error(`El número de lote "${data.numeroLote}" ya existe para este producto. Por favor, elige un número de lote único.`);
        }
        throw new Error(`Error al modificar la producción: ${error.message}`);
    }

    console.log(`[${SERVICE_NAME}] Successfully updated production via RPC.`);
};