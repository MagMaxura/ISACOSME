import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Use `import type` for type-only imports for User and AuthError to resolve module errors. Removed unused PostgrestError import.
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/supabase';
import { AuthContextType, Profile, AppRole } from '@/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null); // Changed to 'any' to store the full error object

  // Effect 1: Handles user session from Supabase auth state changes.
  useEffect(() => {
    console.log('[AuthContext:Effect1] Setting up auth state listener.');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext:Effect1] Initial session fetch complete.', session ? `User: ${session.user.id}` : 'No session');
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false); // If no session, we are done loading.
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(`[AuthContext:Effect1] Auth state changed. Event: ${_event}`, session ? `User: ${session.user.id}` : 'No session');
      setUser(session?.user ?? null);
    });

    return () => {
      console.log('[AuthContext:Effect1] Unsubscribing from auth state changes.');
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Effect 2: Fetches the user's profile whenever the user ID changes.
  const userId = user?.id;

  const fetchProfile = useCallback(async () => {
    if (!userId) {
        console.log('[AuthContext:fetchProfile] No user ID. Clearing profile and finishing loading.');
        setProfile(null);
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);
    console.log(`[AuthContext:fetchProfile] Fetching profile for user ${userId} via RPC 'get_my_profile' to bypass RLS recursion.`);
    try {
        // Using .single() is idiomatic but throws on 0 rows, so we handle that specific error in the catch block.
        const { data, error: rpcError } = await supabase
            .rpc('get_my_profile')
            .single();

        if (rpcError) {
            // Check for a specific PostgreSQL error code for "function does not exist"
            if (rpcError.code === '42883' || (rpcError.message && rpcError.message.includes('function get_my_profile() does not exist'))) {
                 const enhancedError = {
                     ...rpcError,
                     message: "La función 'get_my_profile' no existe en la base de datos.",
                     details: "Esta función es necesaria para cargar el perfil del usuario de forma segura sin causar errores de recursión con las políticas de seguridad (RLS).",
                     hint: "El administrador debe ejecutar el script SQL que crea la función 'get_my_profile' con la opción SECURITY DEFINER. Esto es crucial para que la aplicación funcione correctamente."
                 };
                 throw enhancedError;
            }
            // For other errors, throw them as is.
            throw rpcError;
        } else if (data) {
            console.log('[AuthContext:fetchProfile] Profile data received via RPC:', data);
            // FIX: Cast `data` to `any` to resolve errors from spreading and accessing properties on an `unknown` type from the RPC call.
            const profileData = data as any;
            // Ensure 'roles' is always an array, even if it's null in the database.
            setProfile({
                ...profileData,
                roles: profileData.roles || [],
            } as Profile);
        } else {
             console.warn('[AuthContext:fetchProfile] RPC call returned no data and no error.');
             setProfile(null);
        }
    } catch (err: any) {
        // FIX: Handle the specific "0 rows" error from .single() gracefully.
        if (err.code === 'PGRST116') {
            console.warn('[AuthContext:fetchProfile] User profile not found (RPC returned 0 rows, caught PGRST116). This can happen if the profile creation trigger failed.');
            setProfile(null);
            // Set a specific, user-friendly error with clear instructions for admins.
            setError({
                message: `Perfil de usuario no encontrado para ${user?.email}.`,
                details: "Su cuenta de autenticación existe, pero no tiene un registro de perfil correspondiente en la base de datos (tabla 'profiles'). Esto suele ocurrir si el usuario se registró antes de que el disparador de base de datos (trigger) 'handle_new_user' estuviera configurado correctamente.",
                hint: `SOLUCIÓN PARA ADMINISTRADORES: Vaya al 'Table Editor' en su dashboard de Supabase. Seleccione la tabla 'profiles' y añada manualmente una fila. Use el ID '${userId}' para la columna 'id' y asigne los roles correctos (ej: ['superadmin']) en la columna 'roles'.`
            });
        } else if (err.message && err.message.includes('Failed to fetch')) {
             console.warn('[AuthContext:fetchProfile] A "Failed to fetch" error occurred, likely masking a database RLS recursion error.');
            setError({
                message: "Error de Red Ocultando un Error de Recursión de Base de Datos.",
                details: "El error 'Failed to fetch' es un síntoma de un problema más profundo en el servidor. La base de datos está fallando al ejecutar su solicitud debido a una 'recursión infinita' en sus Políticas de Seguridad a Nivel de Fila (RLS). Esto sucede cuando una política en la tabla 'profiles' intenta leer de la misma tabla para verificar un permiso, creando un bucle sin fin que bloquea el servidor.",
                hint: "SOLUCIÓN PARA ADMINISTRADORES: La única solución es corregir las políticas en la base de datos. Se necesita un nuevo script SQL que use una técnica más robusta ('SET LOCAL ROLE') para forzar el bypass de RLS y romper el bucle. Por favor, ejecute el script SQL que se le proporcionará para solucionar este problema de raíz."
            });
            setProfile(null);
        } else {
            // Handle all other unexpected errors.
            console.error('[AuthContext:fetchProfile] An unexpected error was caught while fetching the user profile via RPC.');
            console.error('[AuthContext] The raw error object is:', JSON.stringify(err, null, 2));
            setError(err);
            setProfile(null);
        }

    } finally {
        console.log('[AuthContext:fetchProfile] Finished profile fetch attempt.');
        setLoading(false);
    }
  }, [userId, user]);

  useEffect(() => {
    console.log(`[AuthContext:Effect2] Profile fetch effect triggered for user ID: ${userId}`);
    fetchProfile();
  }, [userId, fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    console.log(`[AuthContext:login] Attempting for ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) console.error(`[AuthContext:login] Failed for ${email}:`, error.message);
    else console.log(`[AuthContext:login] Succeeded for ${email}. Auth state will trigger profile fetch.`);
    return { error };
  }, []);

  const signup = useCallback(async (email: string, password: string, role: AppRole = 'cliente', metadata: object = {}) => {
    console.log(`[AuthContext:signup] Attempting for ${email}. Will request role: '${role}'.`);

    // Ensure all metadata fields expected by the trigger have default values.
    // This makes the signup process more robust and acts as a safety net to prevent
    // database trigger errors due to missing NOT NULL fields.
    const finalMetadata = {
        company_name: 'No aplica',
        contact_person: 'No aplica',
        country: 'No aplica',
        message: '',
        ...metadata, // User-provided metadata will override defaults
        roles: [role],
    };
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: finalMetadata
      }
    });

    if (error) {
      console.error(`[AuthContext:signup] Failed for ${email}:`, error.message);
      // The error handling in the Register/Comex pages will catch this and display a detailed message.
      return { error };
    }

    console.log(`[AuthContext:signup] Auth user created for ${email}. Awaiting confirmation.`);
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext:logout] Attempting logout.');
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[AuthContext:logout] Failed:', error.message);
    else console.log('[AuthContext:logout] Succeeded. User state cleared.');
    return { error };
  }, []);
  
  const value: AuthContextType = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    login,
    signup,
    logout,
    retryProfileFetch: fetchProfile,
  }), [user, profile, loading, error, login, signup, logout, fetchProfile]);
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};