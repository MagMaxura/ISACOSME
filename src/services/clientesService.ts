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
    console.log(`[${SERVICE_NAME}] Fetching clients.`);
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*, listas_de_precios(nombre)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
            const transformedData: Cliente[] = data.map(c => ({
                id: c.id,
                nombre: c.nombre, // Nombre del Comercio
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
                listaPrecioNombre: c.listas_de_precios?.nombre || 'N/A',
            }));
            console.log(`[${SERVICE_NAME}] Successfully fetched and transformed ${transformedData.length} clients.`);
            return transformedData;
        }

        console.log(`[${SERVICE_NAME}] No clients found.`);
        return [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching clients:`, error);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS) en la tabla 'clientes'. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        throw new Error(`No se pudieron cargar los clientes: ${error.message}`);
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
        throw new Error(`No se pudieron cargar la lista de clientes: ${error.message}`);
    }
};

export const createCliente = async (clienteData: Partial<Cliente>): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Creating new client: ${clienteData.nombre}`);
    try {
        const { error } = await (supabase.from('clientes') as any).insert([toDatabaseFormat(clienteData)]);
        if (error) throw error;
        console.log(`[${SERVICE_NAME}] Client created successfully.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating client:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al crear el cliente. Revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudo crear el cliente: ${error.message}`);
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
        throw new Error(`No se pudo actualizar el cliente: ${error.message}`);
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
        throw new Error(`No se pudo eliminar el cliente: ${error.message}`);
    }
};