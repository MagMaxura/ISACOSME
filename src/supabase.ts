/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and anon key are required in environment variables.");
}

// Usar <any> para el genérico de la base de datos omite los tipos generados por Supabase.
// Es un enfoque pragmático para resolver errores complejos de TypeScript como
// "Type instantiation is excessively deep", que pueden ocurrir con RLS y consultas complejas.
export const supabase = createClient<any>(supabaseUrl, supabaseKey);