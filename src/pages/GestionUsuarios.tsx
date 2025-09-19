import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { Profile, AppRole, AccessRequest } from '@/types';
import { fetchUsuarios, updateUsuarioRoles, fetchAccessRequests, approveComexRequest, rejectComexRequest } from '@/services/usuariosService';
import { useAuth } from '@/contexts/AuthContext';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';
import { IconUsers, IconClock, IconCheck, IconX, IconAlertCircle } from '@/components/Icons';

const GestionUsuarios: React.FC = () => {
    const { user } = useAuth(); // To identify the current superadmin
    const [usuarios, setUsuarios] = useState<Profile[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [dbSetupError, setDbSetupError] = useState(false);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setDbSetupError(false);
        try {
            const [usersData, requestsData] = await Promise.all([
                fetchUsuarios(),
                fetchAccessRequests(),
            ]);
            setUsuarios(usersData);
            setRequests(requestsData);
        } catch (err: any) {
            setError(err);
            if (err.isFunctionNotFoundError) {
                setDbSetupError(true);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleRoleChange = async (userId: string, changedRole: AppRole, isChecked: boolean) => {
        const originalUsers = JSON.parse(JSON.stringify(usuarios));
        const userToUpdate = usuarios.find(u => u.id === userId);
        if (!userToUpdate) return;

        let newRoles: AppRole[];
        if (isChecked) {
            newRoles = [...new Set([...userToUpdate.roles, changedRole])];
        } else {
            newRoles = userToUpdate.roles.filter(r => r !== changedRole);
        }
        
        setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles } : u));
        
        try {
            await updateUsuarioRoles(userId, newRoles);
        } catch (err: any) {
            setUsuarios(originalUsers);
            setError(err);
        }
    };
    
    const handleRequestAction = async (request: AccessRequest, action: 'approve' | 'reject') => {
        const requestId = request.id;
        setActionLoading(prev => ({ ...prev, [requestId]: true }));
        setError(null);
        try {
            if (action === 'approve') {
                const userToApprove = usuarios.find(u => u.email === request.email);
                if (!userToApprove) {
                    throw new Error(`No se encontró un usuario con el email ${request.email} para aprobar.`);
                }
                await approveComexRequest(requestId, userToApprove.id);
            } else {
                await rejectComexRequest(requestId);
            }
            // Refresh data on success
            await loadData();
        } catch (err: any) {
            setError(err); // Pass the full error object
        } finally {
            setActionLoading(prev => ({ ...prev, [requestId]: false }));
        }
    };

    const allRoles: AppRole[] = ['superadmin', 'vendedor', 'administrativo', 'analitico', 'cliente', 'comex', 'comex_pending'];

    return (
        <div>
            <PageHeader title="Gestión de Usuarios y Permisos" />
            
            {dbSetupError && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6" role="alert">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <IconAlertCircle className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-800">
                                <span className="font-bold">Acción Requerida: Configuración de Base de Datos Incompleta</span>
                                <br />
                                Esta página no puede cargar los datos porque faltan funciones esenciales en la base de datos. 
                                Un administrador debe ejecutar los scripts SQL necesarios para crear estas funciones y permitir que la aplicación funcione correctamente. 
                                La información técnica del error se muestra a continuación.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <DatabaseErrorDisplay error={error} />
            
            <div className={dbSetupError ? 'opacity-50 pointer-events-none' : ''}>
                {/* Pending Requests Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-on-surface mb-4 flex items-center">
                        <IconClock className="h-6 w-6 mr-2 text-primary" />
                        Solicitudes de Acceso Pendientes ({requests.length})
                    </h3>
                    <div className="bg-surface rounded-lg shadow">
                        {loading ? (
                            <p className="p-4 text-center text-gray-500">Cargando solicitudes...</p>
                        ) : requests.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {requests.map(req => (
                                    <li key={req.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{req.company_name} <span className="text-sm font-normal text-gray-500">({req.country})</span></p>
                                            <p className="text-sm text-gray-600">{req.email} (Contacto: {req.contact_person})</p>
                                            {req.message && <p className="text-xs italic text-gray-500 mt-1 bg-gray-50 p-2 rounded">"{req.message}"</p>}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            <button 
                                                onClick={() => handleRequestAction(req, 'approve')} 
                                                disabled={actionLoading[req.id]}
                                                className="px-3 py-1 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 disabled:bg-gray-400 flex items-center"
                                            >
                                                <IconCheck className="h-4 w-4 mr-1" /> Aprobar
                                            </button>
                                            <button 
                                                onClick={() => handleRequestAction(req, 'reject')} 
                                                disabled={actionLoading[req.id]}
                                                className="px-3 py-1 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:bg-gray-400 flex items-center"
                                            >
                                                <IconX className="h-4 w-4 mr-1" /> Rechazar
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-center text-gray-500">No hay solicitudes pendientes.</p>
                        )}
                    </div>
                </div>

                {/* Existing Users Section */}
                 <h3 className="text-xl font-bold text-on-surface mb-4 flex items-center">
                    <IconUsers className="h-6 w-6 mr-2 text-primary" />
                    Usuarios Registrados
                </h3>
                <div className="bg-surface rounded-lg shadow overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario (Email)</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roles Asignados</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr><td colSpan={2} className="p-8 text-center text-gray-500">Cargando usuarios...</td></tr>
                      ) : usuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{usuario.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                               {allRoles.map(role => (
                                   <label key={role} className="flex items-center space-x-2 capitalize cursor-pointer">
                                       <input
                                           type="checkbox"
                                           checked={usuario.roles?.includes(role) || false}
                                           onChange={(e) => handleRoleChange(usuario.id, role, e.target.checked)}
                                           disabled={usuario.id === user?.id}
                                           className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                                           title={usuario.id === user?.id ? "No puedes cambiar tus propios roles" : ""}
                                       />
                                       <span>{role}</span>
                                   </label>
                               ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
        </div>
    );
};

export default GestionUsuarios;