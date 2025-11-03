import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { ProductoEstadistica } from '../types';
import { fetchProductStatistics } from '../services/estadisticasService';
import { updateProductoPrecios } from '../services/productosService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import { IconDeviceFloppy, IconCheck, IconPencil, IconX } from '../components/Icons';

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const EstadisticasProductos: React.FC = () => {
    const [stats, setStats] = useState<ProductoEstadistica[]>([]);
    const [editMode, setEditMode] = useState<Record<string, boolean>>({});
    const [editedData, setEditedData] = useState<Record<string, Partial<ProductoEstadistica>>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [savingState, setSavingState] = useState<Record<string, 'saving' | 'saved' | null>>({});
    const [searchTerm, setSearchTerm] = useState('');

    const loadStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchProductStatistics();
            setStats(data);
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleEditClick = (item: ProductoEstadistica) => {
        setEditMode(prev => ({ ...prev, [item.id]: true }));
        setEditedData(prev => ({ ...prev, [item.id]: { ...item } }));
    };
    
    const handleCancelClick = (productId: string) => {
        setEditMode(prev => ({ ...prev, [productId]: false }));
        setEditedData(prev => {
            const newEditedData = { ...prev };
            delete newEditedData[productId];
            return newEditedData;
        });
    };

    const handlePriceChange = (productId: string, field: 'precioPublico' | 'precioComercio' | 'precioMayorista', value: string) => {
        const numericValue = parseFloat(value);
        if (!isNaN(numericValue)) {
            setEditedData(prev => ({
                ...prev,
                [productId]: {
                    ...prev[productId],
                    [field]: numericValue,
                },
            }));
        }
    };

    const handleSave = async (productId: string) => {
        const changes = editedData[productId];
        if (!changes) return;
        
        setSavingState(prev => ({ ...prev, [productId]: 'saving' }));
        setError(null);
        try {
            const pricesToUpdate = {
                precioPublico: changes.precioPublico!,
                precioComercio: changes.precioComercio!,
                precioMayorista: changes.precioMayorista!,
            };
            await updateProductoPrecios(productId, pricesToUpdate);
            
            setSavingState(prev => ({ ...prev, [productId]: 'saved' }));
            setTimeout(() => {
                setSavingState(prev => ({ ...prev, [productId]: null }));
                setStats(prevStats => prevStats.map(stat => stat.id === productId ? { ...stat, ...pricesToUpdate } : stat));
                handleCancelClick(productId); // Clean up edit state
            }, 2000);

        } catch (err: any) {
            setError(err);
            setSavingState(prev => ({ ...prev, [productId]: null }));
        }
    };

    const ProfitCell: React.FC<{ profit: number; cost: number }> = ({ profit, cost }) => {
        const percentage = cost > 0 ? (profit / cost) * 100 : 0;
        const colorClass = profit >= 0 ? 'text-green-600' : 'text-red-600';

        return (
            <div className={`font-semibold ${colorClass}`}>
                <p>{formatPrice(profit)}</p>
                <p className="text-xs opacity-80">({percentage.toFixed(1)}%)</p>
            </div>
        );
    };

    const dataToRender = useMemo(() => {
        return stats.map(stat => {
            if (editMode[stat.id] && editedData[stat.id]) {
                return { ...stat, ...editedData[stat.id] };
            }
            return stat;
        }).filter(stat => 
            stat.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [stats, editedData, editMode, searchTerm]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando estadísticas...</div>;
    }

    return (
        <div>
            <PageHeader title="Estadísticas de Rentabilidad por Producto" />
            
             <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre de producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                />
            </div>

            <DatabaseErrorDisplay error={error} />

            <div className="bg-surface rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50">
                        <tr>
                            <th className="th-style">Producto</th>
                            <th className="th-style">Ventas (Mes/Año)</th>
                            <th className="th-style">Costo Unit.</th>
                            <th className="th-style">Precio Público</th>
                            <th className="th-style">Precio Comercio</th>
                            <th className="th-style">Precio Mayorista</th>
                            <th className="th-style">Ganancia (Público)</th>
                            <th className="th-style">Ganancia (Comercio)</th>
                            <th className="th-style">Ganancia (Mayorista)</th>
                            <th className="th-style" title="Ventas últimos 12 meses / Stock actual. Un valor más alto indica que el stock 'rota' más rápido.">Tasa Rotación</th>
                            <th className="th-style" title="Ventas promedio por mes, basado en los últimos 90 días.">Tasa Ventas (u/mes)</th>
                            <th className="th-style">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {dataToRender.map(item => {
                            const isInEditMode = editMode[item.id];
                            const gananciaPublico = item.precioPublico - item.costoTotalUnitario;
                            const gananciaComercio = item.precioComercio - item.costoTotalUnitario;
                            const gananciaMayorista = item.precioMayorista - item.costoTotalUnitario;

                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="td-style font-semibold">{item.nombre}</td>
                                    <td className="td-style">{item.ventasMesActual} / {item.ventasAñoActual} u.</td>
                                    <td className="td-style font-medium text-red-600">{formatPrice(item.costoTotalUnitario)}</td>
                                    
                                    <td className="td-style">{isInEditMode ? <input type="number" value={item.precioPublico} onChange={e => handlePriceChange(item.id, 'precioPublico', e.target.value)} className="input-style" /> : formatPrice(item.precioPublico)}</td>
                                    <td className="td-style">{isInEditMode ? <input type="number" value={item.precioComercio} onChange={e => handlePriceChange(item.id, 'precioComercio', e.target.value)} className="input-style" /> : formatPrice(item.precioComercio)}</td>
                                    <td className="td-style">{isInEditMode ? <input type="number" value={item.precioMayorista} onChange={e => handlePriceChange(item.id, 'precioMayorista', e.target.value)} className="input-style" /> : formatPrice(item.precioMayorista)}</td>

                                    <td className="td-style"><ProfitCell profit={gananciaPublico} cost={item.costoTotalUnitario} /></td>
                                    <td className="td-style"><ProfitCell profit={gananciaComercio} cost={item.costoTotalUnitario} /></td>
                                    <td className="td-style"><ProfitCell profit={gananciaMayorista} cost={item.costoTotalUnitario} /></td>

                                    <td className="td-style font-semibold">{item.tasaRotacion.toFixed(2)}</td>
                                    <td className="td-style font-semibold">{item.tasaVentasPromedio.toFixed(1)}</td>

                                    <td className="td-style">
                                        <div className="flex items-center gap-2">
                                            {isInEditMode ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleSave(item.id)}
                                                        disabled={savingState[item.id] === 'saving' || savingState[item.id] === 'saved'}
                                                        className={`p-2 rounded-md transition-colors duration-200 ${
                                                            savingState[item.id] === 'saved' ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'
                                                        }`}
                                                        title="Guardar"
                                                    >
                                                        {savingState[item.id] === 'saving' ? '...' : savingState[item.id] === 'saved' ? <IconCheck className="h-5 w-5"/> : <IconDeviceFloppy className="h-5 w-5"/>}
                                                    </button>
                                                    <button onClick={() => handleCancelClick(item.id)} className="p-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300" title="Cancelar">
                                                        <IconX className="h-5 w-5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => handleEditClick(item)} className="p-2 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200" title="Editar Precios">
                                                    <IconPencil className="h-5 w-5"/>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
                Nota: La ganancia unitaria es la diferencia entre el precio de lista y el costo unitario total. El costo unitario se basa en el costo de insumos más el costo de laboratorio del último lote producido. El porcentaje de ganancia se calcula sobre el costo.
            </p>

            <style>{`
                .th-style { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 700; color: #4A5568; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
                .td-style { padding: 0.75rem 1rem; white-space: nowrap; font-size: 0.875rem; color: #4A5568; vertical-align: middle; }
                .input-style { width: 100px; padding: 0.5rem; border: 1px solid #CBD5E0; border-radius: 0.375rem; text-align: right; }
                .input-style:focus { border-color: #8a5cf6; outline: none; box-shadow: 0 0 0 2px rgba(138, 92, 246, 0.2); }
            `}</style>
        </div>
    );
};

export default EstadisticasProductos;