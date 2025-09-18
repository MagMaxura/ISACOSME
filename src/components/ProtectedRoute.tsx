import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { profile, loading, error, retryProfileFetch, logout } = useAuth();

  const formatError = (err: any): string => {
    if (!err) return 'No pudimos cargar los datos de tu perfil. Tu cuenta puede que no esté completamente configurada o que haya un problema de permisos.';
    if (typeof err === 'string') return err;
    
    let details = `Mensaje: ${err.message || 'No disponible'}`;
    if (err.code) details += `\nCódigo: ${err.code}`;
    if (err.details) details += `\nDetalles: ${err.details}`;
    if (err.hint) details += `\nSugerencia: ${err.hint}`;
    return details;
  }

  if (loading) {
    return <div className="p-8 text-center">Verificando acceso...</div>;
  }

  if (!profile) {
    return (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg max-w-3xl mx-auto mt-10">
            <h2 className="text-xl font-bold text-red-700">Error de Cuenta</h2>
            <p className="mt-2 text-sm text-gray-600">No se pudo cargar tu perfil de usuario. Aquí está el error técnico detallado:</p>
            <div className="mt-2 text-red-600 text-left whitespace-pre-wrap text-sm p-4 bg-white border border-red-200 rounded-md font-mono">
                {formatError(error)}
            </div>
            <div className="mt-6 flex items-center justify-center gap-4">
                <button
                    onClick={() => retryProfileFetch()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                    Reintentar Carga
                </button>
                <button
                    onClick={async () => await logout()}
                    className="px-4 py-2 text-sm font-medium text-white bg-secondary border border-transparent rounded-md shadow-sm hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
                >
                    Cerrar Sesión
                </button>
            </div>
             <p className="mt-6 text-xs text-gray-500">
                Si el problema persiste después de seguir las instrucciones y reintentar, contacta al soporte técnico.
            </p>
        </div>
    );
  }

  const hasPermission = profile.roles && profile.roles.some(userRole => allowedRoles.includes(userRole));

  if (!hasPermission) {
    return (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-xl font-bold text-red-700">Acceso Denegado</h2>
            <p className="text-red-600">No tienes los permisos necesarios para ver esta página.</p>
        </div>
    );
  }

  return children;
};

export default ProtectedRoute;
