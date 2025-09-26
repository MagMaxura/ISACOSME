import { supabase } from '../supabase';
import { ListaPrecioItem, ListMeta, Producto } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

const SERVICE_NAME = 'PreciosService';

// Fetches metadata for all available price lists
export const fetchListasDePrecios = async (): Promise<ListMeta[]> => {
    console.log(`[${SERVICE_NAME}] Fetching price lists metadata.`);
    try {
        const { data, error } = await supabase
            .from('listas_de_precios')
            .select('id, nombre')
            .order('nombre', { ascending: true });

        if (error) throw error;
        
        console.log(`[${SERVICE_NAME}] Successfully fetched ${data.length} price lists.`);
        return data || [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching price lists:`, error);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS) en 'listas_de_precios'. Por favor, revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudieron cargar las listas de precios: ${error?.message}`);
    }
};

// Fetches all products and their prices for a specific price list
export const fetchProductosDeLista = async (listaId: string): Promise<ListaPrecioItem[]> => {
    console.log(`[${SERVICE_NAME}] Fetching products for price list ID: ${listaId}`);
    try {
        const response = await (supabase
            .from('lista_precio_productos') as any)
            .select(`
                precio,
                productos (
                    id,
                    nombre,
                    linea
                )
            `)
            .eq('lista_id', listaId)
            .order('created_at', { referencedTable: 'productos', ascending: true });

        if (response.error) throw response.error;

        const transformedData: ListaPrecioItem[] = (response.data || [])
            .filter((item: any) => item.productos) // Filter out items where the product might have been deleted
            .map((item: any) => ({
                productoId: item.productos.id,
                productoNombre: item.productos.nombre,
                precio: item.precio,
                linea: item.productos.linea,
            }));

        console.log(`[${SERVICE_NAME}] Successfully fetched ${transformedData.length} products for the list.`);
        return transformedData;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching products for price list:`, error);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS) en 'lista_precio_productos'. Por favor, revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudieron cargar los productos de la lista: ${error?.message}`);
    }
};

export const fetchAllProducts = async (): Promise<Pick<Producto, 'id' | 'nombre' | 'linea' | 'precioPublico'>[]> => {
    console.log(`[${SERVICE_NAME}] Fetching all products for price list management.`);
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('id, nombre, linea, precio_publico')
            .order('nombre', { ascending: true });

        if (error) throw error;
        
        console.log(`[${SERVICE_NAME}] Successfully fetched ${data?.length || 0} base products.`);
        return (data || []).map((p: any) => ({
            id: p.id,
            nombre: p.nombre,
            linea: p.linea,
            precioPublico: p.precio_publico ?? 0,
        }));
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching all products:`, error);
        if (error.message?.includes('security policy') || error.message?.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS) en 'productos'. Por favor, revisa las políticas de seguridad.`);
        }
        throw new Error(`No se pudieron cargar los productos: ${error?.message}`);
    }
};

export const createListaDePrecios = async (nombre: string): Promise<ListMeta> => {
    console.log(`[${SERVICE_NAME}] Creating new price list with name: ${nombre}`);
    try {
        const { data, error } = await (supabase
            .from('listas_de_precios') as any)
            .insert({ nombre })
            .select('id, nombre')
            .single();

        if (error) throw error;

        console.log(`[${SERVICE_NAME}] Successfully created price list with ID: ${data.id}`);
        return data;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error creating price list:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al crear en 'listas_de_precios'.`);
        }
        if (error.message?.includes('duplicate key value')) {
            throw new Error(`Ya existe una lista de precios con el nombre "${nombre}".`);
        }
        throw new Error(`No se pudo crear la lista de precios: ${error?.message}`);
    }
};

export const upsertPreciosDeLista = async (listaId: string, precios: { productoId: string; precio: number }[]): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Upserting ${precios.length} prices for list ID: ${listaId}`);
    try {
        const itemsToUpsert = precios.map(p => ({
            lista_id: listaId,
            producto_id: p.productoId,
            precio: p.precio
        }));

        const { error } = await (supabase
            .from('lista_precio_productos') as any)
            .upsert(itemsToUpsert, { onConflict: 'lista_id, producto_id' });

        if (error) throw error;

        console.log(`[${SERVICE_NAME}] Successfully upserted prices.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error upserting prices:`, error);
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) al guardar en 'lista_precio_productos'.`);
        }
        throw new Error(`No se pudieron guardar los precios: ${error?.message}`);
    }
};

export const createListaConProductos = async (nombre: string, productos: { productoId: string; precio: number }[]): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Creating new price list "${nombre}" with ${productos.length} products via RPC.`);
    try {
        // This mapping ensures the data is in the snake_case format the database RPC expects.
        const productosParaRpc = productos.map(p => ({
            producto_id: p.productoId,
            precio: p.precio
        }));

        const { error } = await supabase.rpc('create_lista_con_productos', {
            p_nombre_lista: nombre,
            p_productos_precios: productosParaRpc,
        });
        
        if (error) throw error;
        
        console.log(`[${SERVICE_NAME}] Successfully created price list "${nombre}".`);

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error in RPC create_lista_con_productos:`, error);
        
        const functionNotFound = error.code === '42883' || error.message?.includes('function create_lista_con_productos does not exist');
        if (functionNotFound) {
             throw {
                message: "Error de base de datos: La función 'create_lista_con_productos' no existe.",
                details: "Esta función es necesaria para guardar una vista de precios como una nueva lista editable en la base de datos.",
                hint: "Ejecuta el siguiente script SQL en tu editor de Supabase para crear la función.",
                sql: `CREATE OR REPLACE FUNCTION create_lista_con_productos(
    p_nombre_lista text,
    p_productos_precios jsonb
)
RETURNS uuid AS $$
DECLARE
    v_new_lista_id uuid;
    item record;
BEGIN
    -- Check for duplicate list name first to give a clearer error
    IF EXISTS (SELECT 1 FROM public.listas_de_precios WHERE nombre = p_nombre_lista) THEN
        RAISE EXCEPTION 'Ya existe una lista de precios con el nombre "%"', p_nombre_lista;
    END IF;

    -- Create the new price list and get its ID
    INSERT INTO public.listas_de_precios (nombre)
    VALUES (p_nombre_lista)
    RETURNING id INTO v_new_lista_id;

    -- Loop through the JSONB array of products and prices and insert them
    FOR item IN SELECT * FROM jsonb_to_recordset(p_productos_precios) AS x(producto_id uuid, precio numeric)
    LOOP
        INSERT INTO public.lista_precio_productos (lista_id, producto_id, precio)
        VALUES (v_new_lista_id, item.producto_id, item.precio);
    END LOOP;
    
    RETURN v_new_lista_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
            };
        }
        
        if (error.message?.includes('duplicate key value') || error.message?.includes('Ya existe una lista de precios')) {
             throw new Error(`Ya existe una lista de precios con el nombre "${nombre}". Por favor, elige otro nombre.`);
        }

        throw new Error(`No se pudo crear la lista: ${error?.message}`);
    }
};