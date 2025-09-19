
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IconCopy } from '@/components/Icons';

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
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4" role="alert">
      <p className="font-bold">Ocurrió un Error</p>
      <p>No se pudo completar la acción debido a un problema con la base de datos.</p>
      
      <div className="mt-2 text-red-600 text-left whitespace-pre-wrap text-xs p-3 bg-red-50 border border-red-200 rounded-md font-mono">
        <strong>Información Técnica:</strong>
        <br />
        <strong>Mensaje:</strong> {formatted.message}
        {formatted.details && <><br /><strong>Detalles:</strong> {formatted.details}</>}
        {formatted.hint && <><br /><strong>Sugerencia:</strong> {formatted.hint}</>}
      </div>

      {formatted.sql && (
        <div className="mt-4">
            <h4 className="font-bold text-sm text-gray-800">Código SQL para Solucionar el Problema:</h4>
            <div className="relative bg-gray-800 text-white p-4 rounded-md mt-2 font-mono text-xs overflow-x-auto">
                <button
                    onClick={() => handleCopy(formatted.sql!)}
                    className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white p-1.5 rounded-md text-xs"
                    title="Copiar al portapapeles"
                >
                    {copied ? 'Copiado!' : <IconCopy className="h-4 w-4" />}
                </button>
                <pre><code>{formatted.sql}</code></pre>
            </div>
        </div>
      )}

      <p className="mt-3 text-sm">
        Si el problema persiste después de recargar la página, por favor contacta al administrador del sistema con la información técnica de arriba.
      </p>
       <div className="mt-4">
          <button onClick={handleLogout} className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
             Cerrar Sesión
          </button>
       </div>
    </div>
  );
};

export default DatabaseErrorDisplay;
