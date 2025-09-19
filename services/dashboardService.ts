import { supabase } from '../supabase';
import { DashboardStats } from '../types';

const SERVICE_NAME = 'DashboardService';

export const fetchDashboardData = async (): Promise<DashboardStats> => {
    console.log(`[${SERVICE_NAME}] Fetching all dashboard data via RPC 'get_dashboard_stats'.`);
    try {
        const { data, error } = await supabase.rpc('get_dashboard_stats', {}).single();

        if (error) {
            console.error(`[${SERVICE_NAME}] Error fetching dashboard data via RPC:`, error);
            throw error;
        }

        if (!data) {
            throw new Error('La llamada a la base de datos para el dashboard no devolvió datos.');
        }

        console.log(`[${SERVICE_NAME}] Successfully fetched dashboard data via RPC.`);
        return data as DashboardStats;
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Exception while fetching dashboard data:`, error);
        
        // More robust check for the "function not found" error from Supabase/PostgREST.
        const functionNotFound = 
            error.message?.includes('function get_dashboard_stats does not exist') || 
            error.message?.includes('Could not find the function');

        if (functionNotFound) {
            throw {
                message: "Error de base de datos: La función 'get_dashboard_stats' no existe.",
                details: "Esta función es crucial para recopilar todas las estadísticas que se muestran en el Dashboard. Sin ella, la página principal no puede funcionar.",
                hint: "Ejecuta el siguiente script SQL en tu editor de Supabase para crear la función necesaria.",
                sql: `CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
DECLARE
    total_sales_count integer;
    total_revenue_val numeric;
    total_product_stock_val bigint;
    total_insumos_count_val integer;
    low_stock_products_json json;
    low_stock_insumos_json json;
BEGIN
    -- Total sales count
    SELECT COUNT(*) INTO total_sales_count FROM ventas;

    -- Total revenue for the current year
    SELECT COALESCE(SUM(total), 0) INTO total_revenue_val
    FROM ventas
    WHERE date_part('year', fecha) = date_part('year', CURRENT_DATE);

    -- Total product stock
    SELECT COALESCE(SUM(cantidad_actual), 0) INTO total_product_stock_val FROM lotes;

    -- Total insumos types
    SELECT COUNT(*) INTO total_insumos_count_val FROM insumos;

    -- Low stock products (stock < 50)
    WITH product_stock AS (
        SELECT producto_id, SUM(cantidad_actual) as stock
        FROM lotes
        GROUP BY producto_id
    )
    SELECT json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'stock', ps.stock))
    INTO low_stock_products_json
    FROM productos p
    JOIN product_stock ps ON p.id = ps.producto_id
    WHERE ps.stock < 50;

    -- Low stock insumos (stock < 100)
    SELECT json_agg(json_build_object('id', i.id, 'nombre', i.nombre, 'stock', i.stock, 'unidad', i.unidad))
    INTO low_stock_insumos_json
    FROM insumos i
    WHERE i.stock < 100;

    RETURN json_build_object(
        'totalSales', COALESCE(total_sales_count, 0),
        'totalRevenue', COALESCE(total_revenue_val, 0),
        'totalProductStock', COALESCE(total_product_stock_val, 0),
        'totalInsumosCount', COALESCE(total_insumos_count_val, 0),
        'lowStockProducts', COALESCE(low_stock_products_json, '[]'::json),
        'lowStockInsumos', COALESCE(low_stock_insumos_json, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
            };
        }
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) en 'get_dashboard_stats'. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        // Re-throw the already created descriptive error or a new one
        throw error instanceof Error ? error : new Error(`Error inesperado al cargar datos del dashboard: ${error?.message || 'Error desconocido'}`);
    }
};