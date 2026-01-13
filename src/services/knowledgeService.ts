
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
            details: "La base de datos está intentando verificar tus permisos de forma infinita. Esto ocurre cuando una política intenta consultar la tabla 'profiles' de forma cíclica.",
            hint: "SOLUCIÓN DEFINITIVA: Ejecuta este SQL que lee los roles directamente del Token (JWT) sin consultar tablas extra, eliminando el bucle:",
            sql: `-- 1. Habilitar RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- 2. Política de Lectura (Para todos los autenticados)
DROP POLICY IF EXISTS "Lectura de conocimiento" ON public.knowledge_base;
CREATE POLICY "Lectura de conocimiento" ON public.knowledge_base FOR SELECT TO authenticated USING (true);

-- 3. Política de Edición (Evita recursión usando metadatos del JWT)
DROP POLICY IF EXISTS "Edición para personal autorizado" ON public.knowledge_base;
CREATE POLICY "Edición para personal autorizado" 
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
            details: "Tu usuario no tiene permisos para realizar cambios en la base de conocimiento.",
            hint: "Contacta al administrador para que verifique tus roles asignados."
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
