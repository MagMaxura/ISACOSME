import { supabase } from '../supabase';
import { ProductoEstadistica } from '../types';

const SERVICE_NAME = 'EstadisticasService';

export const fetchProductStatistics = async (): Promise<ProductoEstadistica[]> => {
    console.log(`[${SERVICE_NAME}] Fetching product statistics via RPC 'get_product_statistics'.`);
    try {
        const { data, error } = await supabase.rpc('get_product_statistics');
        if (error) {
            // Handle function not found error
             if (error.message?.includes('function get_product_statistics does not exist')) {
                throw {
                    message: "La función 'get_product_statistics' no existe o está desactualizada.",
                    details: "Esta función es necesaria para calcular las estadísticas de rentabilidad de los productos. La versión actual en la app calcula los costos en tiempo real para mayor precisión.",
                    hint: "Un administrador debe ejecutar el script SQL proporcionado para crear o actualizar esta función.",
                    sql: `CREATE OR REPLACE FUNCTION get_product_statistics()
RETURNS TABLE (
    id uuid,
    nombre text,
    ventas_mes_actual bigint,
    ventas_totales bigint,
    costo_total_unitario numeric,
    ganancia_unitaria_publico numeric,
    ganancia_unitaria_comercio numeric,
    ganancia_unitaria_mayorista numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH
    sales_agg AS (
        -- Correctly aggregates sales data per product.
        SELECT
            vi.producto_id,
            SUM(vi.cantidad) AS total_sold,
            SUM(CASE WHEN date_trunc('month', v.fecha) = date_trunc('month', CURRENT_DATE) THEN vi.cantidad ELSE 0 END) AS month_sold
        FROM public.venta_items vi
        JOIN public.ventas v ON vi.venta_id = v.id
        GROUP BY vi.producto_id
    ),
    recent_lab_cost AS (
        -- Correctly gets the per-unit lab cost from the most recent production lot.
        SELECT DISTINCT ON (producto_id)
            producto_id,
            costo_laboratorio
        FROM public.lotes
        ORDER BY producto_id, created_at DESC
    ),
    insumo_costs_agg AS (
        -- NEW: Calculate the current total insumo cost for each product in real-time.
        SELECT
            pi.producto_id,
            SUM(pi.cantidad * i.costo) as total_insumo_cost
        FROM public.productos_insumos pi
        JOIN public.insumos i ON pi.insumo_id = i.id
        GROUP BY pi.producto_id
    )
    SELECT
        p.id,
        p.nombre,
        COALESCE(sa.month_sold, 0)::bigint AS ventas_mes_actual,
        COALESCE(sa.total_sold, 0)::bigint AS ventas_totales,
        -- Corrected cost calculation: Use the dynamically calculated insumo cost + the recent lab cost.
        (COALESCE(ica.total_insumo_cost, 0) + COALESCE(rlc.costo_laboratorio, 0))::numeric AS costo_total_unitario,
        -- Corrected profit calculations using the new accurate total cost.
        (COALESCE(p.precio_publico, 0) - (COALESCE(ica.total_insumo_cost, 0) + COALESCE(rlc.costo_laboratorio, 0)))::numeric AS ganancia_unitaria_publico,
        (COALESCE(p.precio_comercio, 0) - (COALESCE(ica.total_insumo_cost, 0) + COALESCE(rlc.costo_laboratorio, 0)))::numeric AS ganancia_unitaria_comercio,
        (COALESCE(p.precio_mayorista, 0) - (COALESCE(ica.total_insumo_cost, 0) + COALESCE(rlc.costo_laboratorio, 0)))::numeric AS ganancia_unitaria_mayorista
    FROM
        public.productos p
    LEFT JOIN
        sales_agg sa ON p.id = sa.producto_id
    LEFT JOIN
        recent_lab_cost rlc ON p.id = rlc.producto_id
    LEFT JOIN
        insumo_costs_agg ica ON p.id = ica.producto_id
    ORDER BY
        p.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
                }
            }
            throw error;
        }
        
        return (data || []).map((item: any) => ({
            id: item.id,
            nombre: item.nombre,
            ventasMesActual: item.ventas_mes_actual ?? 0,
            ventasTotales: item.ventas_totales ?? 0,
            costoTotalUnitario: item.costo_total_unitario ?? 0,
            // These total profit fields are no longer returned by the updated RPC,
            // but we keep them in the mapping to satisfy the type, though they will be 0.
            // The UI will use the unit profit fields instead.
            gananciaTotalPublico: 0, 
            gananciaTotalComercio: 0,
            gananciaTotalMayorista: 0,
            gananciaUnitariaPublico: item.ganancia_unitaria_publico ?? 0,
            gananciaUnitariaComercio: item.ganancia_unitaria_comercio ?? 0,
            gananciaUnitariaMayorista: item.ganancia_unitaria_mayorista ?? 0,
        }));

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching product statistics:`, error);
        throw error;
    }
};