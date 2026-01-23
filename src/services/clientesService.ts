
import { supabase } from '../supabase';
import { Cliente, SimpleCliente } from '../types';

const SERVICE_NAME = 'ClientesService';

// Maps frontend camelCase to backend snake_case
const toDatabaseFormat = (cliente: Partial<Cliente>) => ({
  nombre: cliente.nombre,
  representante: cliente.representante || null,
  provincia: cliente.provincia || null,
  localidad: cliente.localidad || null,
  codigo_postal: cliente.codigoPostal || null,
  direccion: cliente.direccion || null,
  rubro: cliente.rubro || 'Consumidor Final',
  telefono: cliente.telefono || null,
  red_social: cliente.redSocial || null,
  cuit: cliente.cuit || null,
  email: cliente.email ? cliente.email.toLowerCase().trim() : null,
  descripcion: cliente.descripcion || null,
  lista_precio_id: cliente.listaPrecioId || null,
  lista_enviada: cliente.listaEnviada || false,
  fecha_envio_lista: cliente.fechaEnvioLista || null,
  tiene_stock: cliente.tieneStock || false,
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
            return transformedData;
        }
        return [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching clients:`, error);
        if (error.message?.includes('function get_clientes_con_ventas does not exist')) {
            throw {
                message: "La función 'get_clientes_con_ventas' no existe.",
                hint: "Ejecuta el script SQL en Supabase para crear 'get_clientes_con_ventas'.",
                sql: `CREATE OR REPLACE FUNCTION get_clientes_con_ventas()
RETURNS TABLE (id uuid, created_at timestamptz, nombre text, representante text, provincia text, localidad text, codigo_postal text, direccion text, rubro text, telefono text, red_social text, cuit text, email text, descripcion text, lista_precio_id uuid, lista_enviada boolean, fecha_envio_lista date, tiene_stock boolean, lista_precio_nombre text, total_comprado numeric) AS $$
BEGIN
    RETURN QUERY SELECT c.id, c.created_at, c.nombre, c.representante, c.provincia, c.localidad, c.codigo_postal, c.direccion, c.rubro, c.telefono, c.red_social, c.cuit, c.email, c.descripcion, c.lista_precio_id, c.lista_enviada, c.fecha_envio_lista, c.tiene_stock, lp.nombre as lista_precio_nombre, (SELECT COALESCE(SUM(v.total), 0) FROM public.ventas v WHERE v.cliente_id = c.id AND (v.estado = 'Pagada' OR v.estado = 'Enviada')) as total_comprado FROM public.clientes c LEFT JOIN public.listas_de_precios lp ON c.lista_precio_id = lp.id ORDER BY c.created_at DESC;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;`
            }
        }
        throw error;
    }
};

export const fetchSimpleClientes = async (): Promise<SimpleCliente[]> => {
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
        throw error;
    }
};

export const createCliente = async (clienteData: Partial<Cliente>): Promise<string> => {
    console.log(`[${SERVICE_NAME}] Creating client record.`);
    try {
        const payload = toDatabaseFormat(clienteData);
        const { data, error } = await (supabase.from('clientes') as any)
            .insert([payload])
            .select('id')
            .single();
            
        if (error) throw error;
        return data.id;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating client:`, error);
        throw error;
    }
};

/**
 * Busca un cliente por email (insensible a mayúsculas). Si no existe, lo crea.
 */
export const getOrCreateClientByEmail = async (payerInfo: any): Promise<string> => {
    const cleanEmail = payerInfo.email.toLowerCase().trim();
    console.log(`[${SERVICE_NAME}] Identifying client: ${cleanEmail}`);
    
    try {
        // 1. Buscar por email (ilike para mayor seguridad)
        const { data: existing, error: searchError } = await supabase
            .from('clientes')
            .select('id')
            .ilike('email', cleanEmail)
            .maybeSingle();
            
        if (searchError) throw searchError;
        
        if (existing) {
            console.log(`[${SERVICE_NAME}] Found existing client ID: ${existing.id}`);
            return existing.id;
        }
        
        // 2. Crear nuevo si no existe
        console.log(`[${SERVICE_NAME}] Client not found. Creating automatic record.`);
        const newClientData: Partial<Cliente> = {
            nombre: `${payerInfo.name} ${payerInfo.surname}`.trim(),
            email: cleanEmail,
            telefono: payerInfo.phone,
            direccion: `${payerInfo.street_name} ${payerInfo.street_number}`.trim(),
            localidad: payerInfo.city,
            provincia: payerInfo.province,
            codigoPostal: payerInfo.zip_code,
            rubro: 'Venta Web',
            descripcion: `Autocreado desde Checkout (DNI: ${payerInfo.dni})`,
        };
        
        return await createCliente(newClientData);
        
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] getOrCreateClientByEmail Failed:`, error);
        throw error;
    }
};

export const updateCliente = async (clienteId: string, clienteData: Partial<Cliente>): Promise<void> => {
    try {
        const payload = toDatabaseFormat(clienteData);
        const { error } = await (supabase
            .from('clientes') as any)
            .update(payload)
            .eq('id', clienteId);
        if (error) throw error;
    } catch (error: any) {
        throw error;
    }
};

export const deleteCliente = async (clienteId: string): Promise<void> => {
    try {
        const { error } = await (supabase
            .from('clientes') as any)
            .delete()
            .eq('id', clienteId);
        if (error) throw error;
    } catch (error: any) {
        throw error;
    }
};
