
import { supabase } from '../supabase';
import { KnowledgeItem } from '../types';

const SERVICE_NAME = 'KnowledgeService';

const handleKnowledgeError = (error: any) => {
    console.error(`[${SERVICE_NAME}] Error detectado:`, error);
    
    const isRecursion = error.message?.includes('infinite recursion') || error.code === '42P17';
    
    if (isRecursion) {
        return {
            message: "Error de Seguridad: Bucle en permisos detectado.",
            details: "La base de datos tiene un problema de recursión. Para solucionarlo, debemos asegurar que la función que ya usas tenga la propiedad SECURITY DEFINER.",
            hint: "Ejecuta este SQL para arreglar tu función actual y la política de acceso:",
            sql: `-- 1. Asegurar que TU función existente sea segura
ALTER FUNCTION public.es_staff_seguro() SECURITY DEFINER;

-- 2. Aplicar política a la Base de Conocimiento usando TU función
DROP POLICY IF EXISTS "Escritura base conocimiento" ON public.knowledge_base;
CREATE POLICY "Escritura base conocimiento" 
ON public.knowledge_base FOR ALL 
TO authenticated 
USING (public.es_staff_seguro());`
        };
    }

    if (error.message?.includes('relation "knowledge_base" does not exist')) {
        return {
            message: "La tabla 'knowledge_base' no existe.",
            hint: "Crea la tabla básica para empezar a cargar información.",
            sql: `CREATE TABLE public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    pregunta text NOT NULL,
    respuesta text NOT NULL,
    categoria text DEFAULT 'General'
);
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura libre" ON public.knowledge_base FOR SELECT TO authenticated USING (true);`
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
