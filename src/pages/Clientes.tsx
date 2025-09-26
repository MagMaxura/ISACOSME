import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Table, { Column } from '@/components/Table';
import { Cliente, ListMeta } from '@/types';
import { IconPlus, IconX, IconPencil, IconTrash, IconBrandWhatsapp } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientes, createCliente, updateCliente, deleteCliente } from '@/services/clientesService';
import { fetchListasDePrecios } from '@/services/preciosService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

// --- Cliente Modal Component ---
interface ClienteModalProps {
    onClose: () => void;
    onSuccess: () => void;
    listasDePrecios: ListMeta[];
    clienteToEdit: Partial<Cliente> | null;
}

const ClienteModal: React.FC<ClienteModalProps> = ({ onClose, onSuccess, listasDePrecios, clienteToEdit }) => {
    const isEditMode = !!clienteToEdit?.id;
    const [formData, setFormData] = useState<Partial<Cliente>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<any | null>(null);
    
    useEffect(() => {
        const initialState: Partial<Cliente> = {
            nombre: '',
            representante: '',
            provincia: '',
            localidad: '',
            codigoPostal: '',
            rubro: '',
            telefono: '',
            direccion: '',
            redSocial: '',
            cuit: '',
            email: '',
            descripcion: '',
            listaPrecioId: listasDePrecios[0]?.id || null,
            listaEnviada: false,
            fechaEnvioLista: null,
            tieneStock: false,
        };
        setFormData(isEditMode ? { ...initialState, ...clienteToEdit } : initialState);
    }, [clienteToEdit, isEditMode, listasDePrecios]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checkedValue = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: isCheckbox ? checkedValue : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre) {
            setError({ message: 'El nombre del comercio es requerido.' });
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            if (isEditMode) {
                await updateCliente(clienteToEdit!.id!, formData);
            } else {
                await createCliente(formData);
            }
            onSuccess();
        } catch (err: any) {
            setError(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-full flex flex-col">
          <div className="flex justify-between items-center p-5 border-b">
            <h3 className="text-xl font-semibold text-gray-800">{isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {error && <DatabaseErrorDisplay error={error} />}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Column 1 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Comercio*</label>
                        <input type="text" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} required className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Representante</label>
                        <input type="text" name="representante" value={formData.representante || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                        <div className="mt-1 flex items-center gap-2">
                            <input
                                type="text"
                                name="telefono"
                                value={formData.telefono || ''}
                                onChange={handleInputChange}
                                className="input-style flex-grow"
                                placeholder="Ej: 5491122334455"
                            />
                            <a
                                href={formData.telefono ? `https://web.whatsapp.com/send?phone=${(formData.telefono || '').replace(/\D/g, '')}&text=Hola%20!` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-shrink-0 p-2 rounded-md transition-colors ${
                                    !formData.telefono
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                                aria-label="Abrir chat en WhatsApp"
                                title="Abrir chat en WhatsApp"
                                onClick={(e) => {
                                    if (!formData.telefono) e.preventDefault();
                                }}
                            >
                                <IconBrandWhatsapp className="h-5 w-5" />
                            </a>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                </div>
                {/* Column 2 */}
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Dirección</label>
                        <input type="text" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Localidad</label>
                        <input type="text" name="localidad" value={formData.localidad || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Provincia</label>
                        <input type="text" name="provincia" value={formData.provincia || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Código Postal</label>
                        <input type="text" name="codigoPostal" value={formData.codigoPostal || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                </div>
                 {/* Column 3 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">CUIT</label>
                        <input type="text" name="cuit" value={formData.cuit || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Rubro</label>
                        <input type="text" name="rubro" value={formData.rubro || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Red Social</label>
                        <input type="text" name="redSocial" value={formData.redSocial || ''} onChange={handleInputChange} className="mt-1 input-style w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Lista de Precios</label>
                        <select name="listaPrecioId" value={formData.listaPrecioId || ''} onChange={handleInputChange} className="mt-1 input-style w-full">
                            <option value="">Ninguna</option>
                            {listasDePrecios.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            
             <div>
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <textarea name="descripcion" value={formData.descripcion || ''} onChange={handleInputChange} rows={2} className="mt-1 input-style w-full"></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="flex items-center">
                    <input type="checkbox" name="listaEnviada" id="listaEnviada" checked={!!formData.listaEnviada} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="listaEnviada" className="ml-2 block text-sm text-gray-900">Lista de precios enviada</label>
                </div>
                <div>
                     <label htmlFor="fechaEnvioLista" className="block text-sm font-medium text-gray-700">Fecha de envío</label>
                     <input type="date" name="fechaEnvioLista" id="fechaEnvioLista" value={formData.fechaEnvioLista?.split('T')[0] || ''} onChange={handleInputChange} className="mt-1 input-style w-full" disabled={!formData.listaEnviada} />
                </div>
                 <div className="flex items-center">
                    <input type="checkbox" name="tieneStock" id="tieneStock" checked={!!formData.tieneStock} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="tieneStock" className="ml-2 block text-sm text-gray-900">Tiene Stock</label>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t mt-6">
                <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark disabled:bg-violet-300">
                    {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
                </button>
            </div>
          </form>
        </div>
        <style>{`.input-style { display: block; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; } .input-style:focus { border-color: #8a5cf6; } .input-style:disabled { background-color: #f3f4f6 }`}</style>
      </div>
    );
};

// --- Main Clientes Page ---
const Clientes: React.FC = () => {
    const { profile } = useAuth();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [listasDePrecios, setListasDePrecios] = useState<ListMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Partial<Cliente> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const canManage = profile?.roles?.some(role => ['superadmin', 'vendedor'].includes(role));

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [clientesData, listasData] = await Promise.all([
                fetchClientes(),
                fetchListasDePrecios()
            ]);
            setClientes(clientesData);
            setListasDePrecios(listasData);
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleModalSuccess = () => {
        setIsModalOpen(false);
        setEditingClient(null);
        loadData();
    };

    const handleOpenCreate = () => {
        setEditingClient(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (cliente: Cliente) => {
        setEditingClient(cliente);
        setIsModalOpen(true);
    };

    const handleDelete = async (clienteId: string, clienteNombre: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar a "${clienteNombre}"?`)) {
            try {
                await deleteCliente(clienteId);
                loadData();
            } catch (err: any) {
                setError(err);
            }
        }
    };
    
    const columns: Column<Cliente>[] = [
        { header: 'Comercio', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Email', accessor: 'email', render: (item) => item.email || 'N/A' },
        { header: 'Teléfono', accessor: 'telefono', render: (item) => item.telefono || 'N/A' },
        { header: 'Rubro', accessor: 'rubro', render: (item) => item.rubro || 'N/A' },
        { header: 'Descripción', accessor: 'descripcion', render: (item) => <p className="text-xs max-w-xs whitespace-normal">{item.descripcion || 'N/A'}</p> },
        { header: 'Lista de Precios', accessor: 'listaPrecioNombre' },
        { header: 'Acciones', accessor: 'id', render: (item) => (
            canManage && (
                <div className="flex space-x-3">
                    <button onClick={() => handleOpenEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar"><IconPencil className="h-5 w-5" /></button>
                    <button onClick={() => handleDelete(item.id, item.nombre)} className="text-red-500 hover:text-red-700" title="Eliminar"><IconTrash className="h-5 w-5" /></button>
                </div>
            )
        )}
    ];

    const filteredClientes = useMemo(() =>
        clientes.filter(cliente => {
            const search = searchTerm.toLowerCase();
            return (
                (cliente.nombre?.toLowerCase() || '').includes(search) ||
                (cliente.email?.toLowerCase() || '').includes(search) ||
                (cliente.telefono?.toLowerCase() || '').includes(search) ||
                (cliente.rubro?.toLowerCase() || '').includes(search) ||
                (cliente.localidad?.toLowerCase() || '').includes(search) ||
                (cliente.provincia?.toLowerCase() || '').includes(search)
            );
        }),
        [clientes, searchTerm]
    );

    return (
        <div>
            <PageHeader title="Clientes">
                {canManage && (
                    <button onClick={handleOpenCreate} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nuevo Cliente
                    </button>
                )}
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por comercio, email, teléfono, rubro, ubicación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                />
            </div>

            <Table columns={columns} data={filteredClientes} isLoading={loading}/>
            
            {isModalOpen && (
                <ClienteModal 
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={handleModalSuccess}
                    listasDePrecios={listasDePrecios}
                    clienteToEdit={editingClient}
                />
            )}
        </div>
    );
};

export default Clientes;