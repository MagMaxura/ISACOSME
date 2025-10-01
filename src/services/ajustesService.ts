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
        if (error.message?.includes('relation "public.ajustes_sistema" does not exist')) {
            throw {
                message: "La tabla 'ajustes_sistema' no existe en la base de datos.",
                details: "Esta tabla es necesaria para guardar la configuración del sistema, como los umbrales de precios.",
                hint: "Un administrador debe ejecutar el siguiente script SQL para crear la tabla y las funciones asociadas.",
                sql: `
-- 1. Create the settings table
CREATE TABLE public.ajustes_sistema (
    clave TEXT PRIMARY KEY,
    valor JSONB NOT NULL
);
ALTER TABLE public.ajustes_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins can manage settings" ON public.ajustes_sistema
FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE 'superadmin' = ANY(roles)));
CREATE POLICY "Authenticated users can read settings" ON public.ajustes_sistema
FOR SELECT TO authenticated USING (true);

-- 2. Seed default values
INSERT INTO public.ajustes_sistema (clave, valor) VALUES
('UMBRAL_COMERCIO', '150000'),
('UMBRAL_MAYORISTA', '500000')
ON CONFLICT(clave) DO NOTHING;

-- 3. Create the function to auto-upgrade clients
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
    -- Get thresholds from settings, ensuring they are treated as numbers
    SELECT (valor->>0)::numeric INTO umbral_comercio FROM ajustes_sistema WHERE clave = 'UMBRAL_COMERCIO';
    SELECT (valor->>0)::numeric INTO umbral_mayorista FROM ajustes_sistema WHERE clave = 'UMBRAL_MAYORISTA';

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