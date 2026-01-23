
import { supabase } from '../supabase';
import { Cliente, SimpleCliente } from '../types';

const SERVICE_NAME = 'ClientesService';

// Maps frontend camelCase to backend snake_case
const toDatabaseFormat = (cliente: Partial<Cliente>) => ({
  nombre: cliente.nombre,
  representante: cliente.representante,
  provincia: cliente.provincia,
  localidad: cliente.localidad,
  codigo_postal: cliente.codigoPostal,
  direccion: cliente.direccion,
  rubro: cliente.rubro,
  telefono: cliente.telefono,
  red_social: cliente.redSocial,
  cuit: cliente.cuit,
  email: cliente.email,
  descripcion: cliente.descripcion,
  lista_precio_id: cliente.listaPrecioId || null,
  lista_enviada: cliente.listaEnviada,
  fecha_envio_lista: cliente.fechaEnvioLista || null,
  tiene_stock: cliente.tieneStock,
});


export const fetchClientes = async (): Promise<Cliente[]> => {
    console.log(`[${SERVICE_NAME}] Fetching clients via RPC 'get_clientes_con_ventas'.`);
    try {
        const { data, error } = await supabase.rpc('get_clientes_con_ventas');

        if (error) throw error;

        if (data) {
            const transformedData: Cliente[] = data.map((c: any) => ({
                id: c.id,
                nombre: c.nombre,
                representante: c.representante,
                provincia: c.provincia,
                localidad: c.localidad,
                codigoPostal: c.codigo_postal,
                rubro: c.rubro,
                telefono: c.telefono,
                direccion: c.direccion,
                redSocial: c.red_social,
                cuit: c.cuit,
                email: c.email,
                descripcion: c.descripcion,
                listaPrecioId: c.lista_precio_id,
                listaEnviada: c.lista_enviada,
                fechaEnvioLista: c.fecha_envio_lista,
                tieneStock: c.tiene_stock,
                fechaRegistro: new Date(c.created_at).toLocaleDateString('es-AR'),
                listaPrecioNombre: c.lista_precio_nombre || 'N/A',
                totalComprado: c.total_comprado || 0,
            }));
            console.log(`[${SERVICE_NAME}] Successfully fetched and transformed ${transformedData.length} clients.`);
            return transformedData;
        }

        console.log(`[${SERVICE_NAME}] No clients found.`);
        return [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching clients:`, error);
        if (error.message?.includes('function get_clientes_con_ventas does not exist')) {
            throw {
                message: "La función 'get_clientes_con_ventas' no existe en la base de datos.",
                details: "Esta función es necesaria para mostrar la lista de clientes junto con el total de sus compras, lo cual es usado para la categorización automática.",
                hint: "Un administrador debe ejecutar el siguiente script SQL para crear la función.",
                sql: `
CREATE OR REPLACE FUNCTION get_clientes_con_ventas()
RETURNS TABLE (
    id uuid,
    created_at timestamptz,
    nombre text,
    representante text,
    provincia text,
    localidad text,
    codigo_postal text,
    direccion text,
    rubro text,
    telefono text,
    red_social text,
    cuit text,
    email text,
    descripcion text,
    lista_precio_id uuid,
    lista_enviada boolean,
    fecha_envio_lista date,
    tiene_stock boolean,
    lista_precio_nombre text,
    total_comprado numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.created_at,
        c.nombre,
        c.representante,
        c.provincia,
        c.localidad,
        c.codigo_postal,
        c.direccion,
        c.rubro,
        c.telefono,
        c.red_social,
        c.cuit,
        c.email,
        c.descripcion,
        c.lista_precio_id,
        c.lista_enviada,
        c.fecha_envio_lista,
        c.tiene_stock,
        lp.nombre as lista_precio_nombre,
        (SELECT COALESCE(SUM(v.total), 0)
         FROM public.ventas v
         WHERE v.cliente_id = c.id AND (v.estado = 'Pagada' OR v.estado = 'Enviada')) as total_comprado
    FROM public.clientes c
    LEFT JOIN public.listas_de_precios lp ON c.lista_precio_id = lp.id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`
            }
        }
        throw new Error(`No se pudieron cargar los clientes: ${error?.message}`);
    }
};

export const fetchSimpleClientes = async (): Promise<SimpleCliente[]> => {
    console.log(`[${SERVICE_NAME}] Fetching simple clients list.`);
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id, nombre, telefono, email, direccion, localidad, provincia, listas_de_precios(nombre)')
            .order('nombre', { ascending: true });

        if (error) throw error;
        
        return (data || []).map((c: any) => ({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono,
            email: c.email,
            direccion: c.direccion,
            localidad: c.localidad,
            provincia: c.provincia,
            listaPrecioNombre: c.listas_de_precios?.nombre || 'Público',
        }));
    } catch (error: any) {
         console.error(`[${SERVICE_NAME}] Error fetching simple clients:`, error);
        throw new Error(`No se pudieron cargar la lista de clientes: ${error?.message}`);
    }
};

export const createCliente = async (clienteData: Partial<Cliente>): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating new client: ${clienteData.nombre}`);
    try {
        const { data, error } = await (supabase.from('clientes') as any)
            .insert([toDatabaseFormat(clienteData)])
            .select('id')
            .single();
        if (error) throw error;
        console.log(`[${SERVICE_NAME}] Client created successfully with ID: ${data.id}`);
        return data.id;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating client:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al crear el cliente. Revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudo crear el cliente: ${error?.message}`);
    }
};

/**
 * Busca un cliente por email. Si no existe, lo crea con la información proporcionada.
 * Utilizado durante el proceso de checkout.
 */
export const getOrCreateClientByEmail = async (payerInfo: any): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Identifying client for email: ${payerInfo.email}`);
    
    try {
        // 1. Intentar buscar por email
        const { data: existing, error: searchError } = await supabase
            .from('clientes')
            .select('id')
            .eq('email', payerInfo.email.toLowerCase().trim())
            .maybeSingle();
            
        if (searchError) throw searchError;
        
        if (existing) {
            console.log(`[${SERVICE_NAME}] Client already exists with ID: ${existing.id}`);
            return existing.id;
        }
        
        // 2. Si no existe, crear uno nuevo
        console.log(`[${SERVICE_NAME}] Client not found. Creating automatic record.`);
        const newClientData: Partial<Cliente> = {
            nombre: `${payerInfo.name} ${payerInfo.surname}`.trim(),
            email: payerInfo.email.toLowerCase().trim(),
            telefono: payerInfo.phone,
            direccion: payerInfo.street_name + ' ' + payerInfo.street_number,
            localidad: payerInfo.city,
            provincia: payerInfo.province,
            codigoPostal: payerInfo.zip_code,
            rubro: 'Consumidor Final Web',
            descripcion: `Cliente creado automáticamente desde Checkout Web (DNI: ${payerInfo.dni})`,
        };
        
        return await createCliente(newClientData);
        
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error in getOrCreateClientByEmail:`, error);
        throw error;
    }
};

export const updateCliente = async (clienteId: string, clienteData: Partial<Cliente>): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Updating client ID: ${clienteId}`);
    try {
        const { error } = await (supabase
            .from('clientes') as any)
            .update(toDatabaseFormat(clienteData))
            .eq('id', clienteId);
        if (error) throw error;
        console.log(`[${SERVICE_NAME}] Client updated successfully.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error updating client:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al actualizar el cliente. Revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudo actualizar el cliente: ${error?.message}`);
    }
};

export const deleteCliente = async (clienteId: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Deleting client ID: ${clienteId}`);
    try {
        const { error } = await (supabase
            .from('clientes') as any)
            .delete()
            .eq('id', clienteId);
        if (error) throw error;
        console.log(`[${SERVICE_NAME}] Client deleted successfully.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error deleting client:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al eliminar el cliente. Revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudo eliminar el cliente: ${error?.message}`);
    }
};
