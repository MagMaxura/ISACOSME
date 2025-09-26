import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { ListMeta, ProductoConPrecio } from '../types';
import { fetchListasDePrecios, fetchAllProducts, createListaDePrecios, fetchProductosDeLista, upsertPreciosDeLista } from '../services/preciosService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import { IconDeviceFloppy, IconPlus, IconX } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { fetchUmbrales, saveUmbrales, Umbrales } from '../services/ajustesService';


const UmbralesPrecios: React.FC = () => {
    const [umbrales, setUmbrales] = useState<Umbrales>({ comercio: 0, mayorista: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<any | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const loadUmbrales = async () => {
            setLoading(true);
            try {
                const data = await fetchUmbrales();
                setUmbrales(data);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadUmbrales();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await saveUmbrales(umbrales);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setUmbrales(prev => ({...prev, [name]: parseFloat(value) || 0 }));
    }
    
    if(loading) return <div className="p-4 text-center">Cargando umbrales...</div>

    return (
        <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
            <h3 className="text-xl font-bold text-on-surface mb-4">Umbrales de Categorización de Clientes</h3>
            <DatabaseErrorDisplay error={error} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                 <div>
                    <label htmlFor="umbralComercio" className="block text-sm font-medium text-gray-700">Monto para acceder a lista 'Comercio' (ARS)</label>
                    <input type="number" name="comercio" id="umbralComercio" value={umbrales.comercio} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                 <div>
                    <label htmlFor="umbralMayorista" className="block text-sm font-medium text-gray-700">Monto para acceder a lista 'Mayorista' (ARS)</label>
                    <input type="number" name="mayorista" id="umbralMayorista" value={umbrales.mayorista} onChange={handleChange} className="mt-1 w-full input-style" />
                </div>
                <div>
                    <button onClick={handleSave} disabled={saving} className="w-full flex justify-center items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-colors disabled:bg-gray-400">
                        <IconDeviceFloppy className="h-5 w-5 mr-2" />
                        {saving ? 'Guardando...' : 'Guardar Umbrales'}
                    </button>
                </div>
            </div>
            {success && <p className="text-green-600 text-sm mt-2">Umbrales guardados con éxito.</p>}
            <p className="text-xs text-gray-500 mt-2">
                Un cliente ascenderá a la categoría 'Comercio' o 'Mayorista' automáticamente una vez que el total de sus compras pagadas supere estos montos. El sistema nunca degrada a un cliente.
            </p>
            <style>{`.input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; } .input-style:focus { border-color: #8a5cf6; }`}</style>
        </div>
    );
};


const GestionListasPrecios: React.FC = () => {
    const { profile } = useAuth();
    const [listas, setListas] = useState<ListMeta[]>([]);
    const [selectedListaId, setSelectedListaId] = useState<string>('');
    const [productosConPrecios, setProductosConPrecios] = useState<ProductoConPrecio[]>([]);
    const [originalPrecios, setOriginalPrecios] = useState<Record<string, number>>({});
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');

    const isSuperAdmin = profile?.roles?.includes('superadmin');

    const hasChanges = useMemo(() => {
        if (Object.keys(originalPrecios).length === 0) return false;
        return productosConPrecios.some(p => originalPrecios[p.id] !== p.precioAsignado);
    }, [productosConPrecios, originalPrecios]);

    const loadLists = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const listasData = await fetchListasDePrecios();
            setListas(listasData);
            if (listasData.length > 0 && !selectedListaId) {
                setSelectedListaId(listasData[0].id);
            } else if (listasData.length === 0) {
                 setProductosConPrecios([]);
                 setLoading(false);
            }
        } catch (err: any) {
            setError(err);
            setLoading(false);
        }
    }, [selectedListaId]);

    useEffect(() => {
        loadLists();
    }, []);

    useEffect(() => {
        if (!selectedListaId) {
            if (listas.length > 0) setSelectedListaId(listas[0].id);
            else setLoading(false);
            return;
        }

        const loadPricesForList = async () => {
            setLoading(true);
            setError(null);
            try {
                const [allProducts, preciosLista] = await Promise.all([
                    fetchAllProducts(),
                    fetchProductosDeLista(selectedListaId)
                ]);

                const preciosMap = new Map<string, number>();
                preciosLista.forEach(item => {
                    preciosMap.set(item.productoId, item.precio);
                });

                const combinedData: ProductoConPrecio[] = allProducts.map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    linea: p.linea,
                    precioPublico: p.precioPublico,
                    precioAsignado: preciosMap.has(p.id) ? preciosMap.get(p.id)! : p.precioPublico,
                }));

                setProductosConPrecios(combinedData);
                
                const original = combinedData.reduce((acc, p) => {
                    acc[p.id] = p.precioAsignado;
                    return acc;
                }, {} as Record<string, number>);
                setOriginalPrecios(original);

            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        loadPricesForList();
    }, [selectedListaId, listas]);

    const handlePriceChange = (productoId: string, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (!isNaN(price) && price >= 0) {
            setProductosConPrecios(prev =>
                prev.map(p => p.id === productoId ? { ...p, precioAsignado: price } : p)
            );
        }
    };
    
    const handleSaveChanges = async () => {
        if (!hasChanges) return;
        setIsSaving(true);
        setError(null);
        try {
            const preciosToUpsert = productosConPrecios
                .filter(p => originalPrecios[p.id] !== p.precioAsignado)
                .map(p => ({
                    productoId: p.id,
                    precio: p.precioAsignado,
                }));

            await upsertPreciosDeLista(selectedListaId, preciosToUpsert);
            
            const original = productosConPrecios.reduce((acc, p) => {
                acc[p.id] = p.precioAsignado;
                return acc;
            }, {} as Record<string, number>);
            setOriginalPrecios(original);
        } catch (err: any) {
            setError(err);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            const newList = await createListaDePrecios(newListName);
            setListas(prev => [...prev, newList]);
            setSelectedListaId(newList.id);
            setIsCreateModalOpen(false);
            setNewListName('');
        } catch (err: any) {
            setError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const formatPrice = (price: number) => price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div>
            <PageHeader title="Gestión de Listas de Precios" />
            <DatabaseErrorDisplay error={error} />

            {isSuperAdmin && <UmbralesPrecios />}
            
            <div className="bg-surface p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="lista-select" className="font-semibold text-gray-700">Seleccionar Lista:</label>
                    <select
                        id="lista-select"
                        value={selectedListaId}
                        onChange={(e) => setSelectedListaId(e.target.value)}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                        disabled={loading}
                    >
                        {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition-colors">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Crear Lista
                    </button>
                    <button onClick={handleSaveChanges} disabled={!hasChanges || isSaving} className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <IconDeviceFloppy className="h-5 w-5 mr-2" />
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Línea</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Público (Ref.)</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Precio Asignado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Cargando productos...</td></tr>
                        ) : productosConPrecios.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.nombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.linea || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatPrice(p.precioPublico)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="relative">
                                        <span className="absolute left-3 inset-y-0 flex items-center text-gray-500">$</span>
                                        <input
                                            type="number"
                                            value={p.precioAsignado}
                                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                                            className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isCreateModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center p-5 border-b">
                            <h3 className="text-xl font-semibold text-gray-800">Crear Nueva Lista de Precios</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><IconX className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleCreateList} className="p-6 space-y-4">
                             <div>
                                <label htmlFor="newListName" className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Lista</label>
                                <input
                                    type="text"
                                    id="newListName"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                                    required
                                />
                            </div>
                            <div className="flex justify-end pt-4 border-t mt-6">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300">Cancelar</button>
                                <button type="submit" disabled={isSaving} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark disabled:bg-violet-300">
                                    {isSaving ? 'Creando...' : 'Crear Lista'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionListasPrecios;