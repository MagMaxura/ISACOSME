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
        throw new Error(`No se pudieron cargar los depósitos: ${error?.message}`);
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
        throw new Error(`No se pudo crear el depósito: ${error?.message}`);
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
        throw new Error(`No se pudo actualizar el depósito: ${error?.message}`);
    }
};

export const deleteDeposito = async (id: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Deleting deposito: ${id}`);
    try {
        const { error } = await supabase.from('depositos').delete().eq('id', id);
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error deleting deposito:`, error);
        throw new Error(`No se pudo eliminar el depósito: ${error?.message}`);
    }
};

export const transferirStock = async (loteId: string, depositoDestinoId: string, cantidad: number): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Transferring ${cantidad} from lot ${loteId} to deposit ${depositoDestinoId}`);
    try {
        const { error } = await (supabase.rpc as any)('transferir_stock', {
            p_lote_id: loteId,
            p_deposito_destino_id: depositoDestinoId,
            p_cantidad: cantidad,
        });

        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error in RPC transferir_stock:`, error);
        const functionNotFound = error.code === '42883' || error.message?.includes('function transferir_stock does not exist') || error.message?.includes('Could not find the function');
        if (functionNotFound) {
             throw {
                message: "Error de base de datos: La función 'transferir_stock' no existe.",
                details: "Esta función es vital para mover inventario entre depósitos. Sin ella, no se pueden realizar transferencias.",
                hint: "Ejecuta el siguiente script SQL en tu editor de Supabase para crear la función necesaria.",
                sql: `CREATE OR REPLACE FUNCTION transferir_stock(
    p_lote_id uuid,
    p_deposito_destino_id uuid,
    p_cantidad integer,
    p_notas text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_lote lotes%ROWTYPE;
    v_nuevo_lote_id uuid;
    v_usuario_email text;
BEGIN
    -- Get the current user's email
    SELECT email INTO v_usuario_email FROM auth.users WHERE id = auth.uid();

    -- Get the source lot details
    SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id;

    -- Check for sufficient stock
    IF v_lote.cantidad_actual < p_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en el lote de origen.';
    END IF;
    
    -- Check if destination is different from origin
    IF v_lote.deposito_id = p_deposito_destino_id THEN
        RAISE EXCEPTION 'El depósito de destino no puede ser el mismo que el de origen.';
    END IF;

    -- Update the source lot
    UPDATE lotes SET cantidad_actual = cantidad_actual - p_cantidad WHERE id = p_lote_id;

    -- Create or update the lot in the destination warehouse
    INSERT INTO lotes (producto_id, numero_lote, cantidad_inicial, cantidad_actual, fecha_vencimiento, costo_laboratorio, deposito_id)
    VALUES (v_lote.producto_id, v_lote.numero_lote, p_cantidad, p_cantidad, v_lote.fecha_vencimiento, v_lote.costo_laboratorio, p_deposito_destino_id)
    ON CONFLICT (producto_id, numero_lote, deposito_id) DO UPDATE
    SET cantidad_actual = lotes.cantidad_actual + EXCLUDED.cantidad_actual,
        cantidad_inicial = lotes.cantidad_inicial + EXCLUDED.cantidad_inicial
    RETURNING id INTO v_nuevo_lote_id;

    -- Log the transfer
    INSERT INTO transferencias_stock (producto_id, lote_origen_id, deposito_origen_id, deposito_destino_id, cantidad, usuario_id, notas, lote_destino_id)
    VALUES (v_lote.producto_id, p_lote_id, v_lote.deposito_id, p_deposito_destino_id, p_cantidad, auth.uid(), p_notas, v_nuevo_lote_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
            };
        }
        throw new Error(`No se pudo realizar la transferencia: ${error?.message}`);
    }
};

export const fetchTransferencias = async (): Promise<TransferenciaStock[]> => {
    console.log(`[${SERVICE_NAME}] Fetching transfer history via RPC.`);
    try {
        const { data, error } = await (supabase.rpc as any)('get_historial_transferencias', {});

        if (error) throw error;
        
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
            numeroLote: t.numero_lote || null,
        }));

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Full error object from RPC 'get_historial_transferencias':`, JSON.stringify(error, null, 2));
        
        const isStructureMismatchError = (error.code === '42804' || error.message.includes('structure of query does not match'));
        const isColumnMissingError = (error.code === '42703'); // e.g. "column ts.fecha does not exist"
        const functionNotFound = error.code === '42883' || error.message?.includes('function get_historial_transferencias does not exist') || error.message?.includes('Could not find the function');

        if (functionNotFound || isStructureMismatchError || isColumnMissingError) {
             throw {
                message: "Error de base de datos: La función 'get_historial_transferencias' no se encontró o está desactualizada.",
                details: `El sistema detectó un problema con la función de la base de datos que obtiene el historial. Detalles técnicos: ${error.message}`,
                hint: "Ejecute el siguiente script completo en su editor de Supabase. Es una versión más robusta que debería resolver cualquier inconsistencia de tipos de datos.",
                sql: `DROP FUNCTION IF EXISTS public.get_historial_transferencias();

CREATE OR REPLACE FUNCTION get_historial_transferencias()
RETURNS TABLE (
    id uuid,
    fecha timestamptz,
    producto_nombre text,
    deposito_origen_nombre text,
    deposito_destino_nombre text,
    cantidad integer,
    usuario_email text,
    notas text,
    numero_lote text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ts.id,
        ts.fecha,
        p.nombre,
        origen.nombre,
        destino.nombre,
        ts.cantidad,
        u.email::text,
        ts.notas,
        lote.numero_lote
    FROM transferencias_stock ts
    JOIN productos p ON ts.producto_id = p.id
    JOIN depositos origen ON ts.deposito_origen_id = origen.id
    JOIN depositos destino ON ts.deposito_destino_id = destino.id
    JOIN auth.users u ON ts.usuario_id = u.id
    LEFT JOIN lotes lote ON ts.lote_origen_id = lote.id
    ORDER BY ts.fecha DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
            };
        }
        
        // Fallback for other errors
        throw error;
    }
}