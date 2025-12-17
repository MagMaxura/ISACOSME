import { supabase } from '../supabase';
import { Venta, VentaItem, PuntoDeVenta, OrderItem } from '../types';
import { fetchLotesParaVenta } from './stockService';

const SERVICE_NAME = 'VentasService';

export interface VentaItemParaCrear {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    loteId: string;
}

export interface VentaToCreate extends Omit<Venta, 'id' | 'clienteNombre' | 'items'> {
    items: VentaItemParaCrear[];
}

export const fetchVentas = async (): Promise<Venta[]> => {
    console.log(`[${SERVICE_NAME}] Fetching sales data.`);
    
    // The try/catch wrapper was removed for simplicity. The calling component (`Ventas.tsx`)
    // already has a robust try/catch block to handle any errors that occur here.
    const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre), venta_items(cantidad, precio_unitario, productos(nombre))')
        .order('fecha', { ascending: false });
    
    if (error) {
        // Log the detailed error from Supabase for easier debugging.
        console.error(`[${SERVICE_NAME}] Error fetching sales. Message: ${error.message}. Details: ${error.details || 'N/A'}.`);
        // Throw the original Supabase error object. This is crucial because it contains
        // detailed properties like .code, .details, and .hint, which the UI error
        // component uses to provide a precise diagnosis and solution.
        throw error;
    }
    
    if (data) {
        const transformedData: Venta[] = data.map(v => {
            const items = v.venta_items.map((item: any) => ({
                productoId: '', // Not needed for this view
                cantidad: item.cantidad,
                precioUnitario: item.precio_unitario,
                productoNombre: item.productos?.nombre || 'N/A',
            }));

            return {
                id: v.id,
                clienteId: v.cliente_id,
                fecha: new Date(v.fecha).toLocaleDateString('es-AR'),
                subtotal: v.subtotal,
                iva: v.iva,
                total: v.total,
                tipo: v.tipo,
                estado: v.estado,
                clienteNombre: v.clientes?.nombre || 'Consumidor Final',
                items: items,
                observaciones: v.observaciones,
                puntoDeVenta: v.punto_de_venta,
            };
        });
        console.log(`[${SERVICE_NAME}] Successfully fetched and transformed ${transformedData.length} sales.`);
        return transformedData;
    }

    console.log(`[${SERVICE_NAME}] No sales found.`);
    return [];
};

export const fetchVentaPorId = async (id: string): Promise<Venta | null> => {
    try {
        const { data, error } = await supabase
            .from('ventas')
            .select('*, clientes(nombre), venta_items(cantidad, precio_unitario, productos(nombre))')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return null;

        const items = data.venta_items.map((item: any) => ({
            productoId: '', 
            cantidad: item.cantidad,
            precioUnitario: item.precio_unitario,
            productoNombre: item.productos?.nombre || 'N/A',
        }));

        return {
            id: data.id,
            clienteId: data.cliente_id,
            fecha: new Date(data.fecha).toLocaleDateString('es-AR'),
            subtotal: data.subtotal,
            iva: data.iva,
            total: data.total,
            tipo: data.tipo,
            estado: data.estado,
            clienteNombre: data.clientes?.nombre || 'Consumidor Final',
            items: items,
            observaciones: data.observaciones,
            puntoDeVenta: data.punto_de_venta,
        };
    } catch (error) {
        console.error("Error fetching sale by ID:", error);
        return null;
    }
};

export const createVenta = async (ventaData: VentaToCreate): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating new sale.`);
    
    // In a real scenario, this should be a single transaction/RPC call to ensure data integrity.
    // For now, we perform sequential operations and include cleanup logic on failure.
    
    let newVentaId: string | null = null;
    try {
        // 1. Insert into 'ventas' table
        const { data: ventaResult, error: ventaError } = await (supabase
            .from('ventas') as any)
            .insert([ // Insert expects an array, so wrap the object
                {
                    cliente_id: ventaData.clienteId,
                    fecha: ventaData.fecha,
                    subtotal: ventaData.subtotal,
                    iva: ventaData.iva,
                    total: ventaData.total,
                    tipo: ventaData.tipo,
                    estado: ventaData.estado,
                    costo_total: ventaData.costoTotal,
                    tipo_de_cambio: ventaData.tipoDeCambio,
                    pago_1: ventaData.pago1,
                    observaciones: ventaData.observaciones,
                    // FIX: Use correctly named property from VentaToCreate/Venta interface
                    punto_de_venta: ventaData.puntoDeVenta,
                }
            ])
            .select('id')
            .single();

        if (ventaError) throw ventaError;

        newVentaId = ventaResult.id;
        
        // 2. Prepare and insert into 'venta_items'
        const itemsToInsert = ventaData.items.map(item => ({
            venta_id: newVentaId,
            producto_id: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
            lote_id: item.loteId,
        }));

        const { error: itemsError } = await (supabase
            .from('venta_items') as any)
            .insert(itemsToInsert);
        
        if (itemsError) {
            // Attempt to clean up the orphaned sale record if item insertion fails
            console.error(`[${SERVICE_NAME}] Failed to insert sale items. Cleaning up sale record ${newVentaId}`);
            await (supabase.from('ventas') as any).delete().eq('id', newVentaId);
            throw itemsError;
        }

        // 3. IMPORTANT: Stock update should be handled by an RPC function for atomicity.
        // Assuming a trigger on 'venta_items' will handle stock deduction from 'lotes'.
        console.log(`[${SERVICE_NAME}] Sale ${newVentaId} created. Stock update should be handled by backend logic (e.g., trigger).`);

        return newVentaId;

    } catch (error: any) {
        // This general catch block will handle errors from any of the above await calls.
        console.error(`[${SERVICE_NAME}] Error creating sale:`, error);
        throw error;
    }
};

export const updateVentaStatus = async (ventaId: string, newStatus: Venta['estado']): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Updating status for sale ID: ${ventaId} to ${newStatus}`);
    try {
        const { error } = await (supabase
            .from('ventas') as any)
            .update({ estado: newStatus })
            .eq('id', ventaId);

        if (error) {
            console.error(`[${SERVICE_NAME}] Error updating sale status. Message: ${error?.message}.`);
            throw error;
        }
        console.log(`[${SERVICE_NAME}] Successfully updated status for sale ${ventaId}.`);
    } catch (error: any) {
        throw error;
    }
};

export const deleteVenta = async (ventaId: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Deleting sale ID: ${ventaId} and restoring stock via RPC.`);
    try {
        const { error } = await supabase.rpc('eliminar_venta_y_restaurar_stock', {
            p_venta_id: ventaId,
        });

        if (error) {
            console.error(`[${SERVICE_NAME}] Error in RPC 'eliminar_venta_y_restaurar_stock'. Message: ${error?.message}.`);
            const functionNotFound = error.message?.includes('function eliminar_venta_y_restaurar_stock does not exist') || error.message?.includes('Could not find the function') || error.code === '42883';
            if (functionNotFound) {
                throw {
                    message: "Error de base de datos: La función 'eliminar_venta_y_restaurar_stock' no existe.",
                    details: "Esta función es crucial para eliminar una venta de forma segura, ya que garantiza que el stock de los productos vendidos se devuelva a los lotes correspondientes.",
                    hint: "Ejecuta el siguiente script SQL en tu editor de Supabase para crear la función necesaria.",
                    sql: `CREATE OR REPLACE FUNCTION eliminar_venta_y_restaurar_stock(p_venta_id uuid)
RETURNS void AS $$
DECLARE
    item RECORD;
BEGIN
    -- Loop through each item in the sale to restore stock to the correct lot
    FOR item IN
        SELECT lote_id, cantidad FROM venta_items WHERE venta_id = p_venta_id
    LOOP
        UPDATE lotes
        SET cantidad_actual = cantidad_actual + item.cantidad
        WHERE id = item.lote_id;
    END LOOP;

    -- Delete the sale items
    DELETE FROM venta_items WHERE venta_id = p_venta_id;

    -- Delete the sale itself
    DELETE FROM ventas WHERE id = p_venta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
                };
            }
            throw error;
        }
        console.log(`[${SERVICE_NAME}] Successfully deleted sale ${ventaId} and restored stock.`);
    } catch (error: any) {
        // The calling component will handle displaying the error.
        throw error;
    }
};

// --- Helper Function ---
export const prepareVentaItemsFromCart = async (cartItems: OrderItem[]): Promise<VentaItemParaCrear[]> => {
    console.log(`[${SERVICE_NAME}] Preparing sale items and assigning lots for ${cartItems.length} products.`);
    
    // We process items sequentially to ensure stock integrity per item
    const itemsParaCrear: VentaItemParaCrear[] = [];

    for (const item of cartItems) {
        // 1. Fetch valid lots directly from DB (bypassing aggregated RPCs)
        // This ensures we get the absolute latest stock state for the default warehouse (or all warehouses if no ID provided)
        const lotesDisponibles = await fetchLotesParaVenta(item.id); 
        
        // 2. Strict filter: Ignore lots with < 1 unit to avoid DB float->int rounding errors (e.g. 0.4 quantity seen as 0)
        const usableLotes = lotesDisponibles.filter(l => l.cantidad_actual >= 1);
        
        const stockTotal = usableLotes.reduce((acc, l) => acc + l.cantidad_actual, 0);

        if (stockTotal < item.quantity) {
             throw new Error(`Stock insuficiente para el producto "${item.nombre}". Solicitado: ${item.quantity}, Disponible: ${stockTotal}`);
        }

        let cantidadRestante = item.quantity;

        // 3. Allocate stock
        for (const lote of usableLotes) {
            if (cantidadRestante <= 0) break;

            const cantidadDeLote = Math.min(cantidadRestante, lote.cantidad_actual);
            
            itemsParaCrear.push({
                productoId: item.id,
                cantidad: cantidadDeLote,
                precioUnitario: item.unitPrice,
                loteId: lote.id,
            });

            cantidadRestante -= cantidadDeLote;
        }
        
        if (cantidadRestante > 0) {
             // This theoretically shouldn't happen if stockTotal check passed, but acts as a deputy safety
             throw new Error(`Error de asignación de lotes para "${item.nombre}". Por favor intente nuevamente.`);
        }
    }

    return itemsParaCrear;
};