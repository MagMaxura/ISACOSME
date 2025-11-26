
import { supabase } from '../supabase';
import { Venta, VentaItem, PuntoDeVenta } from '../types';
import { fetchProductosConStock } from './productosService';
import { OrderItem } from '@/components/CheckoutModal';

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

// --- New Helper Function ---
export const prepareVentaItemsFromCart = async (cartItems: OrderItem[]): Promise<VentaItemParaCrear[]> => {
    console.log(`[${SERVICE_NAME}] Preparing sale items and assigning lots for ${cartItems.length} products.`);
    
    // 1. Fetch fresh stock data for all involved products
    const allProducts = await fetchProductosConStock();
    const itemsParaCrear: VentaItemParaCrear[] = [];

    for (const item of cartItems) {
        const product = allProducts.find(p => p.id === item.id);
        
        if (!product) {
            throw new Error(`Producto "${item.nombre}" no encontrado o ya no está disponible.`);
        }

        if (product.stockTotal < item.quantity) {
            throw new Error(`Stock insuficiente para "${item.nombre}". Solicitado: ${item.quantity}, Disponible: ${product.stockTotal}.`);
        }

        // 2. Find suitable lots (FIFO strategy: oldest expiration first, or oldest created first)
        // We aggregate all lots from all deposits for the public sale.
        const allLots = product.stockPorDeposito.flatMap(d => d.lotes)
            .filter(l => l.cantidad_actual > 0)
            .sort((a, b) => {
                // Sort by expiration date (if available), then by creation (simulated by ID or assumed sequence)
                if (a.fecha_vencimiento && b.fecha_vencimiento) {
                    return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
                }
                return 0; 
            });

        let cantidadRestante = item.quantity;

        for (const lote of allLots) {
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
             throw new Error(`Error de integridad de stock para "${item.nombre}". El stock total reportado no coincide con la suma de lotes disponibles.`);
        }
    }

    return itemsParaCrear;
};

export const fetchVentas = async (): Promise<Venta[]> => {
    console.log(`[${SERVICE_NAME}] Fetching sales data.`);
    
    const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre), venta_items(cantidad, precio_unitario, productos(nombre))')
        .order('fecha', { ascending: false });
    
    if (error) {
        console.error(`[${SERVICE_NAME}] Error fetching sales. Message: ${error.message}. Details: ${error.details || 'N/A'}.`);
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


export const createVenta = async (ventaData: VentaToCreate): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating new sale.`);
    
    let newVentaId: string | null = null;
    try {
        // 1. Insert into 'ventas' table
        const { data: ventaResult, error: ventaError } = await (supabase
            .from('ventas') as any)
            .insert([ 
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
            console.error(`[${SERVICE_NAME}] Failed to insert sale items. Cleaning up sale record ${newVentaId}`);
            await (supabase.from('ventas') as any).delete().eq('id', newVentaId);
            throw itemsError;
        }

        console.log(`[${SERVICE_NAME}] Sale ${newVentaId} created.`);
        return newVentaId;

    } catch (error: any) {
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
                    details: "Esta función es crucial para eliminar una venta de forma segura.",
                    hint: "Ejecuta el script SQL necesario.",
                    sql: `CREATE OR REPLACE FUNCTION eliminar_venta_y_restaurar_stock(p_venta_id uuid)
RETURNS void AS $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN SELECT lote_id, cantidad FROM venta_items WHERE venta_id = p_venta_id
    LOOP
        UPDATE lotes SET cantidad_actual = cantidad_actual + item.cantidad WHERE id = item.lote_id;
    END LOOP;
    DELETE FROM venta_items WHERE venta_id = p_venta_id;
    DELETE FROM ventas WHERE id = p_venta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
                };
            }
            throw error;
        }
        console.log(`[${SERVICE_NAME}] Successfully deleted sale ${ventaId} and restored stock.`);
    } catch (error: any) {
        throw error;
    }
};
