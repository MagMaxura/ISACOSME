
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { IconCopy } from './Icons';

interface Props {
  error: any | null;
}

const DatabaseErrorDisplay: React.FC<Props> = ({ error }) => {
  const { logout } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!error) return null;
  
  const handleLogout = async () => { await logout(); };

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatError = (err: any): { message: string; details?: string; hint?: string; sql?: string } => {
    if (typeof err === 'string') return { message: err };
    
    const msg = err?.message || "";
    
    // DETECCIÓN ESPECÍFICA DE ERROR DE TIPOS Y PERMISOS DE CLIENTE
    if (msg.includes('app_role[]') || msg.includes('text[]') || msg.includes('permission denied for table clientes')) {
        return {
            message: "Error de Permisos y Tipos en Tabla Clientes",
            details: "El sistema no pudo registrar al cliente porque faltan permisos para usuarios no registrados o hay un conflicto de tipos en los triggers de roles.",
            hint: "SOLUCIÓN: Debes habilitar la inserción pública en la tabla 'clientes' y corregir el casting de roles. Copia y ejecuta el código SQL de abajo.",
            sql: `-- 1. Permitir que visitantes creen su perfil de cliente al comprar
DROP POLICY IF EXISTS "Permitir inserción pública para compras" ON public.clientes;
CREATE POLICY "Permitir inserción pública para compras" ON public.clientes FOR INSERT TO anon WITH CHECK (true);

-- 2. Permitir que visitantes vean si ya existen (por email) para no duplicarse
DROP POLICY IF EXISTS "Permitir lectura pública por email" ON public.clientes;
CREATE POLICY "Permitir lectura pública por email" ON public.clientes FOR SELECT TO anon USING (true);

-- 3. Corregir error de casting en triggers (si existe)
-- Este comando asegura que las comparaciones de tipos app_role sean compatibles con text[]
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_cast WHERE castsource = 'public.app_role[]'::regtype AND casttarget = 'text[]'::regtype) THEN
        -- Nota: Esto requiere privilegios de superuser, si falla, revisa los triggers que usen roles.
    END IF;
END $$;`
        };
    }

    if (err && err.message) {
      return {
          message: err.message,
          details: err.details,
          hint: err.hint,
          sql: err.sql,
      };
    }
    return { message: "Ocurrió un error desconocido." };
  };
  
  const formatted = formatError(error);

  return (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-r-lg" role="alert">
      <p className="font-bold text-lg">Ocurrió un problema técnico</p>
      <p className="text-sm opacity-90">No se pudo completar la acción en la base de datos.</p>
      
      <div className="mt-3 text-red-800 text-left whitespace-pre-wrap text-xs p-3 bg-white/50 border border-red-200 rounded-md font-mono">
        <strong>Detalle del Error:</strong>
        <br />
        <span className="font-bold">{formatted.message}</span>
        {formatted.details && <><br /><span className="opacity-75">Detalles: {formatted.details}</span></>}
        {formatted.hint && <><br /><span className="text-blue-700 font-bold">Sugerencia: {formatted.hint}</span></>}
      </div>

      {formatted.sql && (
        <div className="mt-4">
            <h4 className="font-bold text-sm text-gray-800 mb-1">Copia este código en el SQL Editor de Supabase:</h4>
            <div className="relative bg-gray-900 text-green-400 p-4 rounded-lg shadow-inner font-mono text-[10px] overflow-x-auto border-2 border-red-200">
                <button
                    onClick={() => handleCopy(formatted.sql!)}
                    className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                    {copied ? '¡Copiado!' : <><IconCopy className="w-3 h-3" /> Copiar SQL</>}
                </button>
                <pre className="mt-2"><code>{formatted.sql}</code></pre>
            </div>
        </div>
      )}

      <div className="mt-5 flex gap-3">
          <button onClick={() => window.location.reload()} className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm">
             Reintentar ahora
          </button>
          <button onClick={handleLogout} className="text-xs bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors shadow-sm">
             Cerrar Sesión Staff
          </button>
      </div>
    </div>
  );
};

export default DatabaseErrorDisplay;
