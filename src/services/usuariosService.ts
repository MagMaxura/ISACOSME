import { supabase } from '../supabase';
import { Profile, AppRole, AccessRequest } from '../types';

const SERVICE_NAME = 'UsuariosService';

/**
 * NOTA DE CONFIGURACIÓN:
 * Para solucionar los errores de recursión infinita en las políticas de seguridad (RLS),
 * este servicio ahora depende de funciones de base de datos (RPC) que se ejecutan
 * con permisos elevados (`SECURITY DEFINER`) para evitar los bucles de RLS.
 * El administrador DEBE asegurarse de que las funciones 'get_all_users_as_admin'
 * y 'get_pending_access_requests_as_admin' existan en la base de datos.
 */

export const fetchUsuarios = async (): Promise<Profile[]> => {
    console.log(`[${SERVICE_NAME}] Fetching all user profiles via RPC 'get_all_users_as_admin'.`);
    try {
        // Usar una función RPC con SECURITY DEFINER es la forma más robusta de evitar errores de recursión
        // de RLS cuando un administrador necesita ver todos los perfiles.
        const { data, error } = await supabase.rpc('get_all_users_as_admin');

        if (error) {
            const isFunctionNotFoundError = error.code === '42883' || 
                                            error.code === 'PGRST202' || 
                                            (error.message && (
                                                error.message.includes('does not exist') || 
                                                error.message.includes('Could not find the function')
                                            ));

            if (isFunctionNotFoundError) {
                 const enhancedError = {
                     ...error,
                     message: "La función 'get_all_users_as_admin' no existe en la base de datos.",
                     details: "Esta función es necesaria para que un superadministrador pueda listar a todos los usuarios de forma segura sin causar errores de recursión con las políticas de seguridad (RLS).",
                     hint: "SOLUCIÓN PARA ADMINISTRADORES: Ejecute el script SQL proporcionado para crear la función 'get_all_users_as_admin' con la opción SECURITY DEFINER. Esto es crucial para que la gestión de usuarios funcione.",
                     isFunctionNotFoundError: true
                 };
                 throw enhancedError;
            }
            // Re-lanzar otros errores de RPC
            throw error;
        }
        
        console.log(`[${SERVICE_NAME}] Successfully fetched ${data?.length || 0} users via RPC.`);
        return (data || []).map((u: any) => ({
            id: u.id,
            email: u.email,
            roles: u.roles as AppRole[] || [], // Asegura que roles sea siempre un array
        }));
    } catch (error: any) {
        // El error específico 'function does not exist' se maneja arriba. Esto atrapará ese error mejorado
        // o cualquier otro error inesperado durante el proceso.
        console.error(`[${SERVICE_NAME}] Error fetching users. Raw error:`, JSON.stringify(error, null, 2));
        throw error; // Re-lanzar para que el componente de UI lo maneje.
    }
};

export const updateUsuarioRoles = async (userId: string, newRoles: AppRole[]): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Updating roles for user ${userId} to [${newRoles.join(', ')}].`);
    try {
        const uniqueRoles = [...new Set(newRoles)];

        const { error } = await (supabase
            .from('profiles') as any)
            .update({ roles: uniqueRoles })
            .eq('id', userId);

        if (error) throw error;
        
        console.log(`[${SERVICE_NAME}] Successfully updated roles for user ${userId}.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error updating user roles:`, error.message);
        if (error.message?.includes('security policy')) {
             throw new Error(`Error de permisos (RLS): El rol 'superadmin' no tiene permiso para actualizar la tabla 'profiles' o estás intentando cambiar tus propios roles. Revisa las políticas de seguridad en Supabase.`);
        }
        throw error;
    }
};

// --- Access Request Management ---

export const fetchAccessRequests = async (): Promise<AccessRequest[]> => {
    console.log(`[${SERVICE_NAME}] Fetching pending access requests via RPC 'get_pending_access_requests_as_admin'.`);
    try {
        // Usar una función RPC aquí también evita una posible recursión de RLS si la política
        // en 'access_requests' necesita verificar la tabla 'profiles'.
        const { data, error } = await supabase.rpc('get_pending_access_requests_as_admin');
        
        if (error) {
            const isFunctionNotFoundError = error.code === '42883' || 
                                            error.code === 'PGRST202' || 
                                            (error.message?.includes('does not exist') || 
                                                error.message?.includes('Could not find the function'));
            if (isFunctionNotFoundError) {
                 const enhancedError = {
                     ...error,
                     message: "La función 'get_pending_access_requests_as_admin' no existe en la base de datos.",
                     details: "Esta función es necesaria para que un superadministrador pueda listar las solicitudes de acceso pendientes sin causar errores de recursión con las políticas de seguridad (RLS).",
                     hint: "SOLUCIÓN PARA ADMINISTRADORES: Ejecute el script SQL proporcionado para crear la función 'get_pending_access_requests_as_admin' con la opción SECURITY DEFINER. Esto es crucial para que la gestión de usuarios funcione.",
                     isFunctionNotFoundError: true
                 };
                 throw enhancedError;
            }
            throw error;
        }

        return (data as AccessRequest[]) || [];
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error fetching access requests. Raw error:`, JSON.stringify(error, null, 2));
        throw error; // Re-lanzar para el componente de UI.
    }
};

export const approveComexRequest = async (requestId: string, userId: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Approving COMEX request via RPC for request ID: ${requestId}`);
    try {
        const { error } = await supabase.rpc('approve_comex_request', {
            p_request_id: requestId,
            p_user_id: userId,
        });
        
        if (error) throw error;

        console.log(`[${SERVICE_NAME}] COMEX request approved successfully via RPC.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error approving COMEX request via RPC. Raw error:`, JSON.stringify(error, null, 2));
        if (error.message?.includes('does not exist') || error.code === '42883') {
            throw new Error("Error de base de datos: La función 'approve_comex_request' no existe. Por favor, ejecuta el último script SQL proporcionado para crearla.");
        }
        throw new Error(`No se pudo aprobar la solicitud: ${error.message || 'Error desconocido'}`);
    }
};


export const rejectComexRequest = async (requestId: string): Promise<void> => {
    console.log(`[${SERVICE_NAME}] Rejecting COMEX request via RPC for ID: ${requestId}`);
    try {
        const { error } = await supabase.rpc('reject_comex_request', {
            p_request_id: requestId,
        });
        
        if (error) throw error;
        
        console.log(`[${SERVICE_NAME}] COMEX request rejected successfully via RPC.`);
    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error rejecting COMEX request via RPC. Raw error:`, JSON.stringify(error, null, 2));
        if (error.message?.includes('does not exist') || error.code === '42883') {
            throw new Error("Error de base de datos: La función 'reject_comex_request' no existe. Por favor, ejecuta el último script SQL proporcionado para crearla.");
        }
        throw new Error(`No se pudo rechazar la solicitud: ${error.message || 'Error desconocido'}`);
    }
};