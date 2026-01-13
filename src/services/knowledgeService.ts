
import { supabase } from '../supabase';
import { KnowledgeItem } from '../types';

const SERVICE_NAME = 'KnowledgeService';

const handleKnowledgeError = (error: any) => {
    console.error(`[${SERVICE_NAME}] Error detectado:`, error);
    
    // Detectar recursión infinita
    const isRecursion = error.message?.includes('infinite recursion') || 
                       error.code === '42P17' || 
                       error.message?.includes('loop detected');

    if (isRecursion) {
        return {
            message: "Error de Seguridad Crítico: Bucle de permisos (Recursión).",
            details: "La base de datos no puede verificar tus roles porque las reglas de la tabla 'profiles' y 'knowledge_base' se están llamando una a otra sin fin.",
            hint: "SOLUCIÓN MAESTRA: Copia y ejecuta este código SQL COMPLETO. Limpiará todo y creará una vía de acceso segura:",
            sql: `-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    pregunta text NOT NULL,
    respuesta text NOT NULL,
    categoria text DEFAULT 'General'
);

-- 2. FUNCIÓN ROMPE-BUCLES (v4)
-- SECURITY DEFINER hace que la función use permisos de sistema, saltándose el RLS
CREATE OR REPLACE FUNCTION public.check_staff_secure_v4()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      roles ? 'superadmin' OR 
      roles ? 'vendedor' OR 
      roles ? 'administrativo' OR 
      roles ? 'analitico'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LIMPIEZA TOTAL DE POLÍTICAS (Para evitar conflictos)
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura de conocimiento" ON public.knowledge_base;
DROP POLICY IF EXISTS "Edición para personal autorizado" ON public.knowledge_base;
DROP POLICY IF EXISTS "Acceso restringido a personal de gestión" ON public.knowledge_base;
DROP POLICY IF EXISTS "Permiso total para personal de gestion" ON public.knowledge_base;

-- 4. APLICAR ÚNICA POLÍTICA LIMPIA
CREATE POLICY "Politica_Seguridad_Consolidada_V4" 
ON public.knowledge_base FOR ALL 
TO authenticated 
USING ( public.check_staff_secure_v4() );`
        };
    }

    if (error.code === '42501' || error.message?.includes('permission denied')) {
        return {
            message: "Acceso Denegado.",
            details: "Tu usuario no tiene los roles necesarios (vendedor, administrativo, etc.) registrados en su perfil.",
            hint: "Verifica en la sección de 'Gestión de Usuarios' que tu email tenga asignado al menos uno de los roles de gestión."
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
