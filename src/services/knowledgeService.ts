
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
            details: "La base de datos está intentando verificar tus permisos de forma infinita.",
            hint: "SOLUCIÓN DEFINITIVA: Ejecuta este SQL para restringir el acceso SOLO al personal autorizado, eliminando el permiso general:",
            sql: `-- 1. Habilitar RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar cualquier política previa
DROP POLICY IF EXISTS "Lectura de conocimiento" ON public.knowledge_base;
DROP POLICY IF EXISTS "Edición para personal autorizado" ON public.knowledge_base;

-- 3. Única política para TODO (Lectura y Escritura): Solo Staff
CREATE POLICY "Acceso restringido a personal de gestión" 
ON public.knowledge_base FOR ALL 
TO authenticated 
USING (
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'superadmin' OR 
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'vendedor' OR
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'administrativo' OR
  (auth.jwt() -> 'user_metadata' -> 'roles')::jsonb ? 'analitico'
);`
        };
    }

    if (isForbidden) {
        return {
            message: "Acceso Denegado.",
            details: "Tu usuario no tiene permisos para ver o modificar la base de conocimiento.",
            hint: "Esta sección es privada para el personal de la empresa."
        };
    }

    if (error.message?.includes('relation "knowledge_base" does not exist')) {
        return {
            message: "La tabla 'knowledge_base' no existe.",
            hint: "Crea la tabla ejecutando el script inicial en el editor SQL de Supabase.",
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
