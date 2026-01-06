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

const formatFechaLocal = (fechaStr: string) => {
    if (!fechaStr) return 'N/A';
    const [year, month, day] = fechaStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

export const fetchVentas = async (): Promise<Venta[]> => {
    const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre, telefono), venta_items(cantidad, precio_unitario, productos(nombre))')
        .order('fecha', { ascending: false });
    
    if (error) {
        console.error(`[${SERVICE_NAME}] Error fetching sales:`, error);
        
        // Manejo de error de columna faltante en la lectura
        if (error.message?.includes("column \"tienda\" does not exist") || error.message?.includes("'tienda' column")) {
            throw {
                ...error,
                message: "La columna 'tienda' no existe en la tabla 'ventas'.",
                details: "El sistema ha sido actualizado para rastrear el origen de las ventas (Isabella, Ultrashine, Bodytan), pero la base de datos no tiene el campo necesario.",
                hint: "Ejecuta el script SQL para agregar la columna faltante.",
                sql: `ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS tienda TEXT;`
            };
        }
        throw error;
    }
    
    if (data) {
        return data.map(v => {
            const items = v.venta_items.map((item: any) => ({
                productoId: '', 
                cantidad: item.cantidad,
                precioUnitario: item.precio_unitario,
                productoNombre: item.productos?.nombre || 'N/A',
            }));

            return {
                id: v.id,
                clienteId: v.cliente_id,
                fecha: formatFechaLocal(v.fecha),
                subtotal: v.subtotal,
                iva: v.iva,
                total: v.total,
                tipo: v.tipo,
                estado: v.estado,
                clienteNombre: v.clientes?.nombre || 'Consumidor Final',
                clienteTelefono: v.clientes?.telefono || null,
                items: items,
                observaciones: v.observaciones,
                puntoDeVenta: v.punto_de_venta,
                tienda: v.tienda || null,
            };
        });
    }
    return [];
};

export const fetchVentaPorId = async (id: string): Promise<Venta | null> => {
    try {
        const { data, error } = await supabase
            .from('ventas')
            .select('*, clientes(nombre, telefono), venta_items(cantidad, precio_unitario, productos(nombre))')
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
            fecha: formatFechaLocal(data.fecha),
            subtotal: data.subtotal,
            iva: data.iva,
            total: data.total,
            tipo: data.tipo,
            estado: data.estado,
            clienteNombre: data.clientes?.nombre || 'Consumidor Final',
            items: items,
            observaciones: data.observaciones,
            puntoDeVenta: data.punto_de_venta,
            tienda: data.tienda || null,
        };
    } catch (error) {
        console.error("Error fetching sale by ID:", error);
        return null;
    }
};

export const createVenta = async (ventaData: VentaToCreate): Promise<string> => {
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
                    punto_de_venta: ventaData.punto_de_venta,
                    tienda: ventaData.tienda,
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

        const { error: itemsError } = await (supabase
            .from('venta_items') as any)
            .insert(itemsToInsert);
        
        if (itemsError) {
            await (supabase.from('ventas') as any).delete().eq('id', newVentaId);
            throw itemsError;
        }

        return newVentaId;

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] ERROR DETECTED:`, error);
        
        // Manejo de error de columna faltante en la inserción
        if (error.message?.includes("column \"tienda\" of relation \"ventas\" does not exist") || error.message?.includes("'tienda' column")) {
            throw {
                ...error,
                message: "La columna 'tienda' no existe en la base de datos.",
                details: "El sistema intentó guardar el origen de la venta, pero la tabla 'ventas' no tiene la columna 'tienda'.",
                hint: "SOLUCIÓN: Copia y ejecuta el código SQL de abajo en tu editor de Supabase para corregir la estructura de la tabla.",
                sql: `ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS tienda TEXT;`
            };
        }

        if (error.message?.includes('invalid input value for enum venta_estado')) {
            throw {
                ...error,
                message: "La base de datos no reconoce los nuevos estados ('Carrito Abandonado' o 'Contactado').",
                hint: "Ejecuta el script SQL para actualizar el tipo ENUM de estados de venta.",
                sql: `ALTER TYPE public.venta_estado ADD VALUE IF NOT EXISTS 'Carrito Abandonado';
                      ALTER TYPE public.venta_estado ADD VALUE IF NOT EXISTS 'Contactado';`
            };
        }

        if (error.code === 'P0001' || error.message?.toLowerCase().includes('stock')) {
             throw {
                ...error,
                message: "Error Crítico de Stock: La Base de Datos rechazó la venta.",
                sql: `-- REPARACIÓN STOCK V7
BEGIN;
DROP TRIGGER IF EXISTS trigger_descontar_stock_despues_de_venta ON public.venta_items;
DROP TRIGGER IF EXISTS tr_descontar_stock_venta ON public.venta_items;
CREATE OR REPLACE FUNCTION public.procesar_stock_venta_v7() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.lotes SET cantidad_actual = cantidad_actual - NEW.cantidad WHERE id = NEW.lote_id;
    RETURN NEW;
END; $$;
CREATE TRIGGER tr_venta_items_consolidado AFTER INSERT ON public.venta_items FOR EACH ROW EXECUTE FUNCTION public.procesar_stock_venta_v7();
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
        
        if (error) {
            if (error.message?.includes('invalid input value for enum venta_estado')) {
                throw {
                    ...error,
                    message: "La base de datos no reconoce el nuevo estado de venta.",
                    hint: "Ejecuta el script SQL para actualizar el tipo ENUM.",
                    sql: `ALTER TYPE public.venta_estado ADD VALUE IF NOT EXISTS 'Contactado';`
                };
            }
            throw error;
        }
    } catch (error: any) {
        throw error;
    }
};

// FIX: Added explicit export to resolve the import error in src/pages/Ventas.tsx.
export const assignClientToVenta = async (ventaId: string, clienteId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('ventas')
            .update({ cliente_id: clienteId })
            .eq('id', ventaId);
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error assigning client to sale:`, error);
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
        const usableLotes = lotesDisponibles
            .map(l => ({ ...l, q_floor: Math.floor(l.cantidad_actual) }))
            .filter(l => l.q_floor >= 1);
        
        const stockTotal = usableLotes.reduce((acc, l) => acc + l.q_floor, 0);
        if (stockTotal < item.quantity) {
             throw new Error(`Stock insuficiente para "${item.nombre}".`);
        }

        let cantidadRestante = item.quantity;
        for (const lote of usableLotes) {
            if (cantidadRestante <= 0) break;
            const cantidadDeLote = Math.min(cantidadRestante, lote.q_floor);
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
    }
    return itemsParaCrear;
};
