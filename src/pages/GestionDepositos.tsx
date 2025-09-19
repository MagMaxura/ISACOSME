import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import Table, { Column } from '@/components/Table';
import { Deposito } from '@/types';
import { IconPlus, IconX, IconPencil, IconTrash, IconBuilding } from '@/components/Icons';
import { fetchDepositos, createDeposito, updateDeposito, deleteDeposito } from '@/services/depositosService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

const GestionDepositos: React.FC = () => {
    const [depositos, setDepositos] = useState<Deposito[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentDeposito, setCurrentDeposito] = useState<Partial<Deposito>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchDepositos();
            setDepositos(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetModal = () => {
        setIsModalOpen(false);
        setCurrentDeposito({});
        setIsSubmitting(false);
    };

    const handleOpenCreate = () => {
        setCurrentDeposito({ nombre: '', direccion: '', es_predeterminado: false });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (deposito: Deposito) => {
        setCurrentDeposito(deposito);
        setIsModalOpen(true);
    };

    const handleDelete = async (depositoId: string, nombre: string) => {
        if (window.confirm(`¿Seguro que quieres eliminar el depósito "${nombre}"? Esta acción no se puede deshacer.`)) {
            try {
                await deleteDeposito(depositoId);
                loadData();
            } catch (err: any) {
                setError(`Error al eliminar: ${err.message}`);
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setCurrentDeposito(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentDeposito.nombre) {
            setError('El nombre es requerido.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            if (currentDeposito.id) {
                await updateDeposito(currentDeposito.id, currentDeposito);
            } else {
                await createDeposito(currentDeposito);
            }
            loadData();
            resetModal();
        } catch (err: any) {
            setError(`Error al guardar: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: Column<Deposito>[] = [
        { header: 'Nombre', accessor: 'nombre', render: item => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Dirección', accessor: 'direccion' },
        { header: 'Predeterminado', accessor: 'es_predeterminado', render: item => (
            item.es_predeterminado 
                ? <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Sí</span>
                : <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">No</span>
        )},
        { header: 'Acciones', accessor: 'id', render: item => (
            <div className="flex space-x-3">
                <button onClick={() => handleOpenEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar"><IconPencil className="h-5 w-5" /></button>
                <button onClick={() => handleDelete(item.id, item.nombre)} className="text-red-500 hover:text-red-700" title="Eliminar"><IconTrash className="h-5 w-5" /></button>
            </div>
        )}
    ];

    return (
        <div>
            <PageHeader title="Gestión de Depósitos">
                <button onClick={handleOpenCreate} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors">
                    <IconPlus className="h-5 w-5 mr-2" />
                    Nuevo Depósito
                </button>
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            <Table columns={columns} data={depositos} isLoading={loading} />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                        <div className="flex justify-between items-center p-5 border-b">
                            <h3 className="text-xl font-semibold text-gray-800">{currentDeposito.id ? 'Editar Depósito' : 'Nuevo Depósito'}</h3>
                            <button onClick={resetModal} className="text-gray-400 hover:text-gray-600"><IconX className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre*</label>
                                <input type="text" name="nombre" value={currentDeposito.nombre || ''} onChange={handleInputChange} required className="mt-1 w-full input-style" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                <input type="text" name="direccion" value={currentDeposito.direccion || ''} onChange={handleInputChange} className="mt-1 w-full input-style" />
                            </div>
                            <div className="flex items-center">
                                <input type="checkbox" name="es_predeterminado" id="es_predeterminado" checked={!!currentDeposito.es_predeterminado} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                <label htmlFor="es_predeterminado" className="ml-2 block text-sm text-gray-900">Marcar como depósito predeterminado para producción</label>
                            </div>

                            <div className="flex justify-end pt-4 border-t mt-6">
                                <button type="button" onClick={resetModal} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300">Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark disabled:bg-violet-300">
                                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`.input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; } .input-style:focus { border-color: #8a5cf6; }`}</style>
        </div>
    );
};

export default GestionDepositos;