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
    const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre), venta_items(cantidad, precio_unitario, productos(nombre))')
        .order('fecha', { ascending: false });
    
    if (error) {
        console.error(`[${SERVICE_NAME}] Error fetching sales:`, error);
        throw error;
    }
    
    if (data) {
        const transformedData: Venta[] = data.map(v => {
            const items = v.venta_items.map((item: any) => ({
                productoId: '', 
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
        return transformedData;
    }
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
    
    let newVentaId: string | null = null;
    try {
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
        
        const itemsToInsert = ventaData.items.map(item => ({
            venta_id: newVentaId,
            producto_id: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
            lote_id: item.loteId,
        }));

        console.log(`[${SERVICE_NAME}] Inserting items into venta_items:`, JSON.stringify(itemsToInsert, null, 2));

        const { error: itemsError } = await (supabase
            .from('venta_items') as any)
            .insert(itemsToInsert);
        
        if (itemsError) {
            console.error(`[${SERVICE_NAME}] Failed to insert items. Rolling back sale record ${newVentaId}`);
            await (supabase.from('ventas') as any).delete().eq('id', newVentaId);
            throw itemsError;
        }

        return newVentaId;

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating sale:`, error);

        // ERROR DE STOCK P0001 (RAISE EXCEPTION desde la DB)
        if (error.code === 'P0001' || error.message?.includes('Stock insuficiente')) {
             throw {
                ...error,
                message: "Error de Stock en Base de Datos: La transacción fue rechazada por falta de unidades reales.",
                details: `Detalles técnicos: "${error.message}". Esto ocurre cuando el disparador (trigger) detecta que el lote no tiene suficientes unidades.`,
                hint: "Asegúrate de haber ejecutado el script SQL 'Nuke & Rebuild' en Supabase para limpiar disparadores antiguos y corregir los permisos de seguridad.",
                sql: `-- REPARACIÓN DE CONTROL DE STOCK (DEFINITIVO)
BEGIN;
DROP TRIGGER IF EXISTS on_venta_item_created ON public.venta_items;
DROP TRIGGER IF EXISTS trigger_descontar_stock ON public.venta_items;
DROP FUNCTION IF EXISTS public.handle_new_sale_stock();

CREATE OR REPLACE FUNCTION public.handle_new_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock_actual numeric;
BEGIN
    SELECT cantidad_actual INTO v_stock_actual FROM public.lotes WHERE id = NEW.lote_id FOR UPDATE;
    IF v_stock_actual IS NULL OR (v_stock_actual + 0.001) < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en DB para lote %. Disponible: %, Requerido: %', NEW.lote_id, COALESCE(v_stock_actual, 0), NEW.cantidad;
    END IF;
    UPDATE public.lotes SET cantidad_actual = cantidad_actual - NEW.cantidad WHERE id = NEW.lote_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_venta_item_created AFTER INSERT ON public.venta_items FOR EACH ROW EXECUTE FUNCTION public.handle_new_sale_stock();
COMMIT;`
             };
        }
        throw error;
    }
};

export const updateVentaStatus = async (ventaId: string, newStatus: Venta['estado']): Promise<void> => {
    try {
        const { error } = await (supabase
            .from('ventas') as any)
            .update({ estado: newStatus })
            .eq('id', ventaId);
        if (error) throw error;
    } catch (error: any) {
        throw error;
    }
};

export const deleteVenta = async (ventaId: string): Promise<void> => {
    try {
        const { error } = await supabase.rpc('eliminar_venta_y_restaurar_stock', {
            p_venta_id: ventaId,
        });
        if (error) throw error;
    } catch (error: any) {
        throw error;
    }
};

export const prepareVentaItemsFromCart = async (cartItems: OrderItem[]): Promise<VentaItemParaCrear[]> => {
    const itemsParaCrear: VentaItemParaCrear[] = [];
    for (const item of cartItems) {
        const lotesDisponibles = await fetchLotesParaVenta(item.id); 
        
        // CRITICAL FIX: Floor stock values to avoid phantom units (e.g. 0.99 seen as 1)
        const usableLotes = lotesDisponibles
            .map(l => ({ ...l, cantidad_actual: Math.floor(l.cantidad_actual) }))
            .filter(l => l.cantidad_actual >= 1);
        
        const stockTotal = usableLotes.reduce((acc, l) => acc + l.cantidad_actual, 0);
        if (stockTotal < item.quantity) {
             throw new Error(`Stock insuficiente para "${item.nombre}". Solicitado: ${item.quantity}, Disponible real (entero): ${stockTotal}`);
        }

        let cantidadRestante = item.quantity;
        for (const lote of usableLotes) {
            if (cantidadRestante <= 0) break;
            const cantidadDeLote = Math.min(cantidadRestante, lote.cantidad_actual);
            if (cantidadDeLote > 0) {
                itemsParaCrear.push({
                    productoId: item.id,
                    cantidad: cantidadDeLote,
                    precioUnitario: item.unitPrice,
                    loteId: lote.id,
                });
                cantidadRestante -= cantidadDeLote;
            }
        }
        if (cantidadRestante > 0) {
             throw new Error(`Error de asignación: No se pudieron cubrir las ${item.quantity} unidades de "${item.nombre}" con los lotes disponibles.`);
        }
    }
    return itemsParaCrear;
};