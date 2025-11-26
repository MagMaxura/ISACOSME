
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
      // Only update if the user ID has changed or if transitioning between null/object to prevent deep re-renders on token refresh
      setUser(prevUser => {
          if (prevUser?.id === session?.user?.id && prevUser?.email === session?.user?.email) {
              return prevUser;
          }
          return session?.user ?? null;
      });
    });

    return () => {
      console.log('[AuthContext:Effect1] Unsubscribing from auth state changes.');
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Effect 2: Fetches the user's profile whenever the user ID changes.
  const userId = user?.id;

  const fetchProfile = useCallback(async (force = false) => {
    if (!userId) {
        console.log('[AuthContext:fetchProfile] No user ID. Clearing profile and finishing loading.');
        setProfile(null);
        setLoading(false);
        return;
    }

    // FIX: Do NOT set loading(true) here. This causes the entire App to unmount/remount
    // showing the "Cargando ERP..." screen whenever the profile is refreshed in the background.
    // This was causing the CheckoutModal to close (unmount) while typing.
    // We only want the initial loading state (managed by the useEffects) to block the UI.
    
    setError(null);
    
    console.log(`[AuthContext:fetchProfile] Fetching profile for user ${userId} via RPC 'get_my_profile'.`);
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
            const profileData = data as any;
            setProfile({
                ...profileData,
                roles: profileData.roles || [],
            } as Profile);
        } else {
             console.warn('[AuthContext:fetchProfile] RPC call returned no data and no error.');
             setProfile(null);
        }
    } catch (err: any) {
        if (err.code === 'PGRST116') {
            console.warn('[AuthContext:fetchProfile] User profile not found (RPC returned 0 rows).');
            setProfile(null);
            setError({
                message: `Perfil de usuario no encontrado.`,
                details: "Su cuenta de autenticación existe, pero no tiene un registro de perfil correspondiente.",
                hint: `Contacte al administrador.`
            });
        } else {
            console.error('[AuthContext:fetchProfile] Error fetching profile:', err);
            setError(err);
            setProfile(null);
        }

    } finally {
        console.log('[AuthContext:fetchProfile] Finished profile fetch attempt.');
        // Always ensure loading is false after the first fetch attempt finishes
        setLoading(false);
    }
  }, [userId]); 

  useEffect(() => {
    if (userId) {
        fetchProfile();
    } else {
        setProfile(null);
        // Don't set loading false here immediately if we are waiting for session, 
        // but if userId is null/undefined after auth check, we are done.
        // The onAuthStateChange handles the initial false setting if no session.
    }
  }, [userId, fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    console.log(`[AuthContext:login] Attempting for ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) console.error(`[AuthContext:login] Failed for ${email}:`, error.message);
    return { error };
  }, []);

  const signup = useCallback(async (email: string, password: string, role: AppRole = 'cliente', metadata: object = {}) => {
    console.log(`[AuthContext:signup] Attempting for ${email}.`);
    const finalMetadata = {
        company_name: 'No aplica',
        contact_person: 'No aplica',
        country: 'No aplica',
        message: '',
        ...metadata, 
        roles: [role],
    };
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: finalMetadata
      }
    });

    if (error) console.error(`[AuthContext:signup] Failed for ${email}:`, error.message);
    return { error: error ? error : null };
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext:logout] Attempting logout.');
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[AuthContext:logout] Failed:', error.message);
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
    retryProfileFetch: () => fetchProfile(true),
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
