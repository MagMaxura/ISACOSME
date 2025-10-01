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
                    message: "La función 'get_product_statistics' no existe en la base de datos.",
                    details: "Esta función es necesaria para calcular y mostrar las estadísticas de ventas y ganancias por producto.",
                    hint: "Un administrador debe ejecutar el script SQL proporcionado para crear esta función.",
                    sql: `CREATE OR REPLACE FUNCTION get_product_statistics()
RETURNS TABLE (
    id uuid,
    nombre text,
    ventas_mes_actual bigint,
    ventas_totales bigint,
    costo_total_unitario numeric,
    ganancia_publico numeric,
    ganancia_comercio numeric,
    ganancia_mayorista numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH
    sales_agg AS (
        SELECT
            vi.producto_id,
            SUM(vi.cantidad) AS total_sold,
            SUM(CASE WHEN date_trunc('month', v.fecha) = date_trunc('month', CURRENT_DATE) THEN vi.cantidad ELSE 0 END) AS month_sold
        FROM public.venta_items vi
        JOIN public.ventas v ON vi.venta_id = v.id
        GROUP BY vi.producto_id
    ),
    recent_lab_cost AS (
        SELECT DISTINCT ON (producto_id)
            producto_id,
            costo_laboratorio
        FROM public.lotes
        ORDER BY producto_id, created_at DESC
    )
    SELECT
        p.id,
        p.nombre,
        COALESCE(sa.month_sold, 0)::bigint,
        COALESCE(sa.total_sold, 0)::bigint,
        (COALESCE(p.costo_insumos,0) + COALESCE(rlc.costo_laboratorio, 0))::numeric,
        (p.precio_publico - (COALESCE(p.costo_insumos,0) + COALESCE(rlc.costo_laboratorio, 0))) * COALESCE(sa.total_sold, 0),
        (p.precio_comercio - (COALESCE(p.costo_insumos,0) + COALESCE(rlc.costo_laboratorio, 0))) * COALESCE(sa.total_sold, 0),
        (p.precio_mayorista - (COALESCE(p.costo_insumos,0) + COALESCE(rlc.costo_laboratorio, 0))) * COALESCE(sa.total_sold, 0)
    FROM
        public.productos p
    LEFT JOIN
        sales_agg sa ON p.id = sa.producto_id
    LEFT JOIN
        recent_lab_cost rlc ON p.id = rlc.producto_id
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
            ventasMesActual: item.ventas_mes_actual,
            ventasTotales: item.ventas_totales,
            costoTotalUnitario: item.costo_total_unitario,
            gananciaPublico: item.ganancia_publico,
            gananciaComercio: item.ganancia_comercio,
            gananciaMayorista: item.ganancia_mayorista,
        }));

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching product statistics:`, error);
        throw error;
    }
};