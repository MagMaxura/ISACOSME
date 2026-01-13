
import { supabase } from '../supabase';
import { KnowledgeItem } from '../types';

const SERVICE_NAME = 'KnowledgeService';

const handleKnowledgeError = (error: any) => {
    console.error(`[${SERVICE_NAME}] Error detectado:`, error);
    
    const isRecursion = error.message?.includes('infinite recursion') || error.code === '42P17';
    const isForbidden = error.code === '42501' || error.message?.includes('permission denied');
    
    if (isRecursion) {
        return {
            message: "Error de Seguridad Crítico: Bucle de permisos detectado.",
            details: "La base de datos entró en un ciclo infinito intentando verificar tus roles.",
            hint: "SOLUCIÓN TÉCNICA: Debes crear una función 'Security Definer' para romper la recursión. Ejecuta este SQL:",
            sql: `-- 1. Función que consulta roles saltando el RLS
CREATE OR REPLACE FUNCTION public.check_is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (roles ? 'superadmin' OR roles ? 'vendedor' OR roles ? 'administrativo' OR roles ? 'analitico')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Aplicar política limpia
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso restringido a personal de gestión" ON public.knowledge_base;
CREATE POLICY "Acceso restringido a personal de gestión" 
ON public.knowledge_base FOR ALL 
TO authenticated 
USING ( public.check_is_staff() );`
        };
    }

    if (isForbidden) {
        return {
            message: "Acceso Denegado.",
            details: "No tienes permisos de personal (superadmin, vendedor, etc.) para esta sección.",
            hint: "Si eres administrativo, pide al administrador que verifique tus roles en la sección de Usuarios."
        };
    }

    if (error.message?.includes('relation "knowledge_base" does not exist')) {
        return {
            message: "La tabla de conocimiento no ha sido creada.",
            hint: "Ejecuta el script de creación de tabla en el editor SQL.",
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
