import { supabase } from '../supabase';
import { ProductoEstadistica } from '../types';

const SERVICE_NAME = 'EstadisticasService';

export const fetchProductStatistics = async (): Promise<ProductoEstadistica[]> => {
    console.log(`[${SERVICE_NAME}] Fetching product statistics via RPC 'get_product_statistics_detailed'.`);
    try {
        const { data, error } = await supabase.rpc('get_product_statistics_detailed');
        if (error) {
            // Handle function not found error
             if (error.message?.includes('function get_product_statistics_detailed does not exist')) {
                throw {
                    message: "La función 'get_product_statistics_detailed' no existe o está desactualizada.",
                    details: "Esta función es necesaria para calcular las estadísticas de rentabilidad de los productos. La versión actual en la app calcula los costos en tiempo real y devuelve los precios para su edición.",
                    hint: "Un administrador debe ejecutar el script SQL proporcionado para crear o actualizar esta función.",
                    sql: `CREATE OR REPLACE FUNCTION get_product_statistics_detailed()
RETURNS TABLE (
    id uuid,
    nombre text,
    ventas_mes_actual bigint,
    ventas_año_actual bigint,
    costo_total_unitario numeric,
    precio_publico numeric,
    precio_comercio numeric,
    precio_mayorista numeric,
    stock_total bigint,
    tasa_rotacion numeric,
    tasa_ventas_promedio numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH
    sales_agg AS (
        -- Aggregates sales data for different periods
        SELECT
            vi.producto_id,
            SUM(CASE WHEN v.fecha >= date_trunc('month', CURRENT_DATE) THEN vi.cantidad ELSE 0 END) AS month_sold,
            SUM(CASE WHEN v.fecha >= date_trunc('year', CURRENT_DATE) THEN vi.cantidad ELSE 0 END) AS year_sold,
            SUM(CASE WHEN v.fecha >= (CURRENT_DATE - INTERVAL '90 days') THEN vi.cantidad ELSE 0 END) AS last_90_days_sold,
            SUM(CASE WHEN v.fecha >= (CURRENT_DATE - INTERVAL '1 year') THEN vi.cantidad ELSE 0 END) AS last_12_months_sold
        FROM public.venta_items vi
        JOIN public.ventas v ON vi.venta_id = v.id
        GROUP BY vi.producto_id
    ),
    cost_agg AS (
        -- Calculates total unit cost from the most recent lab cost and current insumo costs
        SELECT
            p.id AS producto_id,
            (
                COALESCE((SELECT SUM(pi.cantidad * i.costo) FROM public.productos_insumos pi JOIN public.insumos i ON pi.insumo_id = i.id WHERE pi.producto_id = p.id), 0) +
                COALESCE((SELECT rlc.costo_laboratorio FROM public.lotes rlc WHERE rlc.producto_id = p.id ORDER BY rlc.created_at DESC LIMIT 1), 0)
            ) AS total_unit_cost
        FROM public.productos p
    ),
    stock_agg AS (
        -- Aggregates current total stock
        SELECT
            l.producto_id,
            SUM(l.cantidad_actual) AS total_stock
        FROM public.lotes l
        GROUP BY l.producto_id
    )
    SELECT
        p.id,
        p.nombre,
        COALESCE(sa.month_sold, 0)::bigint,
        COALESCE(sa.year_sold, 0)::bigint,
        COALESCE(ca.total_unit_cost, 0)::numeric,
        p.precio_publico,
        p.precio_comercio,
        p.precio_mayorista,
        COALESCE(sta.total_stock, 0)::bigint,
        -- Inventory Turnover (Last 12 months sales / Current Stock)
        CASE
            WHEN COALESCE(sta.total_stock, 0) > 0 THEN (COALESCE(sa.last_12_months_sold, 0) / sta.total_stock::numeric)
            ELSE 0
        END::numeric,
        -- Average Sales Rate (Units per month, based on last 90 days)
        (COALESCE(sa.last_90_days_sold, 0) / 3.0)::numeric
    FROM
        public.productos p
    LEFT JOIN sales_agg sa ON p.id = sa.producto_id
    LEFT JOIN cost_agg ca ON p.id = ca.producto_id
    LEFT JOIN stock_agg sta ON p.id = sta.producto_id
    ORDER BY p.nombre;
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
            ventasAñoActual: item.ventas_año_actual ?? 0,
            costoTotalUnitario: item.costo_total_unitario ?? 0,
            precioPublico: item.precio_publico ?? 0,
            precioComercio: item.precio_comercio ?? 0,
            precioMayorista: item.precio_mayorista ?? 0,
            stockTotal: item.stock_total ?? 0,
            tasaRotacion: item.tasa_rotacion ?? 0,
            tasaVentasPromedio: item.tasa_ventas_promedio ?? 0,
        }));

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching product statistics:`, error);
        throw error;
    }
};