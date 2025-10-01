import { supabase } from '../supabase';

const SERVICE_NAME = 'AjustesService';

export interface Umbrales {
    comercio: number;
    mayorista: number;
}

export const fetchUmbrales = async (): Promise<Umbrales> => {
    console.log(`[${SERVICE_NAME}] Fetching price thresholds.`);
    try {
        const { data, error } = await supabase
            .from('ajustes_sistema')
            .select('clave, valor')
            .in('clave', ['UMBRAL_COMERCIO', 'UMBRAL_MAYORISTA']);

        if (error) throw error;
        
        const umbrales: Umbrales = { comercio: 0, mayorista: 0 };
        if (data) {
            for (const row of data) {
                if (row.clave === 'UMBRAL_COMERCIO') {
                    umbrales.comercio = Number(row.valor) || 0;
                } else if (row.clave === 'UMBRAL_MAYORISTA') {
                    umbrales.mayorista = Number(row.valor) || 0;
                }
            }
        }
        return umbrales;

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching thresholds:`, error);

        if (error.message?.includes('infinite recursion')) {
            throw {
                message: "Error de Recursión en Políticas de Seguridad de la Base de Datos.",
                details: `Se detectó un bucle infinito en una política de seguridad. Esto ocurre cuando una política (probablemente en la tabla 'ajustes_sistema') necesita leer de la tabla 'profiles' para verificar permisos, creando un ciclo sin fin que el servidor detiene.`,
                hint: "SOLUCIÓN PARA ADMINISTRADORES: Ejecute este script SQL completo en su editor de Supabase. Arregla las políticas en TODAS las tablas relevantes para romper el bucle recursivo de forma definitiva.",
                sql: `-- Este script soluciona los errores persistentes de "recursión infinita"
-- asegurando que TODAS las políticas que verifican roles de administrador
-- usen una función auxiliar segura.

-- Paso 1: Asegurarse de que la función segura para verificar roles exista.
-- Esta función es la clave para romper el bucle de recursión.
CREATE OR REPLACE FUNCTION public.user_has_role(role_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  has_role BOOLEAN;
BEGIN
  -- Esta consulta se ejecuta con los permisos del creador de la función,
  -- evitando las políticas RLS del usuario actual y previniendo la recursión.
  SELECT role_to_check = ANY(roles)
  INTO has_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(has_role, FALSE);
END;
$function$;

-- Paso 2: Corregir las políticas en la tabla 'ajustes_sistema'.
-- Esta es la tabla que está causando el error actual.

-- Elimina la política antigua y problemática que consulta directamente la tabla 'profiles'.
DROP POLICY IF EXISTS "Superadmins can manage settings" ON public.ajustes_sistema;

-- Vuelve a crear la política de gestión, pero esta vez usando la función segura.
CREATE POLICY "Superadmins can manage settings" ON public.ajustes_sistema
FOR ALL
TO authenticated
USING (user_has_role('superadmin'));
-- Nota: La política de lectura para todos los usuarios autenticados no es problemática y se mantiene.


-- Paso 3: Volver a aplicar las políticas correctas en la tabla 'profiles' por si acaso.
-- Esto asegura que toda la configuración de seguridad sea consistente y robusta.
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

CREATE POLICY "Users can view their own profile." ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Superadmins can view all profiles." ON public.profiles
FOR SELECT
TO authenticated
USING (user_has_role('superadmin'));
`
            };
        }

        if (error.message?.includes('relation "public.ajustes_sistema" does not exist') || error.message?.includes("Could not find the table 'public.ajustes_sistema'")) {
            throw {
                message: "La tabla 'ajustes_sistema' no existe en la base de datos.",
                details: "Esta tabla es necesaria para guardar la configuración del sistema, como los umbrales de precios para la categorización automática de clientes.",
                hint: "Un administrador debe ejecutar el siguiente script SQL para crear la tabla y las funciones asociadas.",
                sql: `
-- 1. Create the settings table idempotently
CREATE TABLE IF NOT EXISTS public.ajustes_sistema (
    clave TEXT PRIMARY KEY,
    valor JSONB NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.ajustes_sistema ENABLE ROW LEVEL SECURITY;

-- 3. Recreate policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Superadmins can manage settings" ON public.ajustes_sistema;
CREATE POLICY "Superadmins can manage settings" ON public.ajustes_sistema
FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE 'superadmin' = ANY(roles)));

DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.ajustes_sistema;
CREATE POLICY "Authenticated users can read settings" ON public.ajustes_sistema
FOR SELECT TO authenticated USING (true);

-- 4. Seed default values safely
INSERT INTO public.ajustes_sistema (clave, valor) VALUES
('UMBRAL_COMERCIO', to_jsonb(150000)),
('UMBRAL_MAYORISTA', to_jsonb(500000))
ON CONFLICT(clave) DO NOTHING;

-- 5. Create or replace the function to auto-upgrade clients
CREATE OR REPLACE FUNCTION actualizar_categoria_cliente(p_cliente_id uuid)
RETURNS void AS $$
DECLARE
    total_comprado numeric;
    umbral_comercio numeric;
    umbral_mayorista numeric;
    lista_comercio_id uuid;
    lista_mayorista_id uuid;
    cliente_actual clientes%ROWTYPE;
BEGIN
    -- Get thresholds from settings
    SELECT valor::numeric INTO umbral_comercio FROM ajustes_sistema WHERE clave = 'UMBRAL_COMERCIO';
    SELECT valor::numeric INTO umbral_mayorista FROM ajustes_sistema WHERE clave = 'UMBRAL_MAYORISTA';

    -- Get price list IDs
    SELECT id INTO lista_comercio_id FROM listas_de_precios WHERE lower(nombre) = 'comercio';
    SELECT id INTO lista_mayorista_id FROM listas_de_precios WHERE lower(nombre) = 'mayorista';

    -- Exit if required price lists or thresholds are not set
    IF lista_comercio_id IS NULL OR lista_mayorista_id IS NULL OR umbral_comercio IS NULL OR umbral_mayorista IS NULL THEN
        RAISE WARNING 'Umbrales o listas de precios (Comercio/Mayorista) no configuradas. Abortando actualización de categoría.';
        RETURN;
    END IF;
    
    -- Get current client data
    SELECT * INTO cliente_actual FROM clientes WHERE id = p_cliente_id;

    -- Calculate total purchases (paid or shipped)
    SELECT COALESCE(SUM(total), 0) INTO total_comprado
    FROM ventas
    WHERE cliente_id = p_cliente_id AND (estado = 'Pagada' OR estado = 'Enviada');

    -- Logic for upgrade (never downgrade)
    IF total_comprado >= umbral_mayorista AND cliente_actual.lista_precio_id IS DISTINCT FROM lista_mayorista_id THEN
        UPDATE clientes SET lista_precio_id = lista_mayorista_id WHERE id = p_cliente_id;
    ELSIF total_comprado >= umbral_comercio AND cliente_actual.lista_precio_id IS DISTINCT FROM lista_mayorista_id AND cliente_actual.lista_precio_id IS DISTINCT FROM lista_comercio_id THEN
        UPDATE clientes SET lista_precio_id = lista_comercio_id WHERE id = p_cliente_id;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`
            };
        }
        throw new Error(`No se pudieron cargar los ajustes: ${error?.message}`);
    }
};

export const saveUmbrales = async (umbrales: Umbrales): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Saving price thresholds.`);
    try {
        const dataToUpsert = [
            { clave: 'UMBRAL_COMERCIO', valor: umbrales.comercio },
            { clave: 'UMBRAL_MAYORISTA', valor: umbrales.mayorista },
        ];
        const { error } = await supabase.from('ajustes_sistema').upsert(dataToUpsert);
        if (error) throw error;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error saving thresholds:`, error);
        throw new Error(`No se pudieron guardar los ajustes: ${error?.message}`);
    }
};
