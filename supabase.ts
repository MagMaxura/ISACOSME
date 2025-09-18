
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qlsyymuldzoyiazyzxlf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsc3l5bXVsZHpveWlhenl6eGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyODczOTEsImV4cCI6MjA3MDg2MzM5MX0.tbMmOLUGdZgh5VeACm7nUZcx5TtIHY7zdKb8v8UDajs';

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and anon key are required.");
}

// Usar <any> para el genérico de la base de datos omite los tipos generados por Supabase.
// Es un enfoque pragmático para resolver errores complejos de TypeScript como
// "Type instantiation is excessively deep", que pueden ocurrir con RLS y consultas complejas.
export const supabase = createClient<any>(supabaseUrl, supabaseKey);