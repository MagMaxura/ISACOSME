import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  error: any | null;
}

const DatabaseErrorDisplay: React.FC<Props> = ({ error }) => {
  const { logout } = useAuth();

  if (!error) return null;
  
  const handleLogout = async () => { await logout(); };

  const formatError = (err: any): string => {
    if (typeof err === 'string') return err;
    if (err && err.message) {
      let details = `Mensaje: ${err.message}`;
      if (err.code) details += `\nCódigo: ${err.code}`;
      if (err.details) details += `\nDetalles: ${err.details}`;
      if (err.hint) details += `\nSugerencia: ${err.hint}`;
      return details;
    }
    return "Ocurrió un error desconocido.";
  };

  return (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4" role="alert">
      <p className="font-bold">Ocurrió un Error</p>
      <p>No se pudo completar la acción debido a un problema con la base de datos.</p>
      
      <div className="mt-2 text-red-600 text-left whitespace-pre-wrap text-xs p-3 bg-red-50 border border-red-200 rounded-md font-mono">
        <strong>Información Técnica:</strong>
        <br />
        {formatError(error)}
      </div>

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