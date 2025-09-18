import { supabase } from '../supabase';
import { DashboardStats } from '../types';

const SERVICE_NAME = 'DashboardService';

export const fetchDashboardData = async (): Promise<DashboardStats> => {
    console.log(`[${SERVICE_NAME}] Fetching all dashboard data via RPC 'get_dashboard_stats'.`);
    try {
        const { data, error } = await supabase.rpc('get_dashboard_stats', {}).single();

        if (error) {
            console.error(`[${SERVICE_NAME}] Error fetching dashboard data via RPC:`, error);
            throw new Error(`Error en RPC 'get_dashboard_stats': ${error.message}`);
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
            throw new Error(`Error de base de datos: La función 'get_dashboard_stats' no existe. Por favor, ejecuta el script SQL de corrección proporcionado para crearla y actualizar las políticas.`);
        }
        if (error.message?.includes('security policy')) {
            throw new Error(`Error de permisos (RLS) en 'get_dashboard_stats'. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        // Re-throw the already created descriptive error or a new one
        throw error instanceof Error ? error : new Error(`Error inesperado al cargar datos del dashboard: ${error.message || 'Error desconocido'}`);
    }
};