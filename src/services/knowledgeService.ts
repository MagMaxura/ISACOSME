
import { supabase } from '../supabase';
import { KnowledgeItem } from '../types';

const SERVICE_NAME = 'KnowledgeService';

const handleKnowledgeError = (error: any) => {
    console.error(`[${SERVICE_NAME}] Error detectado:`, error);
    
    const isRecursion = error.message?.includes('infinite recursion') || error.code === '42P17';
    const isForbidden = error.code === '42501' || error.message?.includes('permission denied');
    
    if (isRecursion) {
        return {
            message: "Error de Seguridad: Bucle detectado en las reglas de acceso.",
            details: "La base de datos está intentando verificar tus permisos de forma infinita. Esto ocurre cuando una regla de 'profiles' se llama a sí misma.",
            hint: "SOLUCIÓN: Usa la lógica de acceso que ya tienes para Ventas, o ejecuta este SQL que evita la recursión leyendo los roles desde el token de sesión (JWT):",
            sql: `-- 1. Habilitar RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- 2. Política de Lectura (Para todos los que ingresan)
DROP POLICY IF EXISTS "Lectura de conocimiento" ON public.knowledge_base;
CREATE POLICY "Lectura de conocimiento" ON public.knowledge_base FOR SELECT TO authenticated USING (true);

-- 3. Política de Edición (Usando la lógica de roles que ya tienes en el ERP)
-- Esta versión evita la recursión al no consultar la tabla 'profiles' directamente
DROP POLICY IF EXISTS "Edición para personal autorizado" ON public.knowledge_base;
CREATE POLICY "Edición para personal autorizado" 
ON public.knowledge_base FOR ALL 
TO authenticated 
USING (
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'superadmin' OR 
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'vendedor' OR
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'administrativo'
);`
        };
    }

    if (isForbidden) {
        return {
            message: "Acceso Denegado.",
            details: "No tienes permisos suficientes para realizar esta acción sobre la base de conocimiento.",
            hint: "Asegúrate de que tu usuario tenga asignado uno de los roles autorizados (superadmin, vendedor o administrativo)."
        };
    }

    if (error.message?.includes('relation "knowledge_base" does not exist')) {
        return {
            message: "La tabla 'knowledge_base' no existe.",
            hint: "Crea la tabla ejecutando el script inicial.",
            sql: `CREATE TABLE public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    pregunta text NOT NULL,
    respuesta text NOT NULL,
    categoria text DEFAULT 'General'
);`
        };
    }

    return error;
};

export const fetchKnowledgeBase = async (): Promise<KnowledgeItem[]> => {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error: any) {
        throw handleKnowledgeError(error);
    }
};

export const createKnowledgeItem = async (item: Partial<KnowledgeItem>): Promise<KnowledgeItem> => {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert([item])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error: any) {
        throw handleKnowledgeError(error);
    }
};

export const updateKnowledgeItem = async (id: string, item: Partial<KnowledgeItem>): Promise<void> => {
    try {
        const { error } = await supabase
            .from('knowledge_base')
            .update(item)
            .eq('id', id);

        if (error) throw error;
    } catch (error: any) {
        throw handleKnowledgeError(error);
    }
};

export const deleteKnowledgeItem = async (id: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('knowledge_base')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error: any) {
        throw handleKnowledgeError(error);
    }
};
