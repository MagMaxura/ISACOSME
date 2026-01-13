
import { supabase } from '../supabase';
import { KnowledgeItem } from '../types';

const SERVICE_NAME = 'KnowledgeService';

const handleKnowledgeError = (error: any) => {
    console.error(`[${SERVICE_NAME}] Error detectado:`, error);
    
    const isRecursion = error.message?.includes('infinite recursion') || error.code === '42P17';
    
    if (isRecursion) {
        return {
            message: "Error de Seguridad Crítico: Bucle en tabla de Perfiles.",
            details: "La base de datos detectó que las reglas de acceso (RLS) se llaman unas a otras sin fin. Esto ocurre usualmente en la tabla 'profiles'.",
            hint: "Es necesario resetear las políticas de la tabla 'profiles' además de las de 'knowledge_base'.",
            sql: `-- EJECUTA ESTO PARA DESBLOQUEAR TODO:
CREATE OR REPLACE FUNCTION public.es_staff_seguro() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ('superadmin' = ANY(roles) OR 'vendedor' = ANY(roles)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Acceso seguro perfiles" ON public.profiles;
CREATE POLICY "Acceso seguro perfiles" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR (public.es_staff_seguro()));

DROP POLICY IF EXISTS "Escritura base conocimiento" ON public.knowledge_base;
CREATE POLICY "Escritura base conocimiento" ON public.knowledge_base FOR ALL TO authenticated USING (public.es_staff_seguro());`
        };
    }

    if (error.message?.includes('relation "knowledge_base" does not exist')) {
        return {
            message: "La tabla 'knowledge_base' no existe.",
            hint: "Crea la tabla ejecutando el script SQL inicial.",
            sql: `CREATE TABLE public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    pregunta text NOT NULL,
    respuesta text NOT NULL,
    categoria text DEFAULT 'General'
);
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura" ON public.knowledge_base FOR SELECT TO authenticated USING (true);`
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
