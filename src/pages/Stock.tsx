import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { IconPlus, IconX, IconPencil } from '../components/Icons';
import { Lote, SimpleProducto, Producto } from '../types';
import Table, { Column } from '../components/Table';
import { useAuth } from '../contexts/AuthContext';
import { registerProduction, updateProduction } from '../services/stockService';
import { fetchSimpleProductos, fetchProductosConStock } from '../services/productosService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

// --- Production Modal Component ---
interface ProductionModalProps {
    onClose: () => void;
    onSuccess: () => void;
    productos: SimpleProducto[];
    loteToEdit: Lote | null;
    productoDeLote?: SimpleProducto;
}

const ProductionModal: React.FC<ProductionModalProps> = ({ onClose, onSuccess, productos, loteToEdit, productoDeLote }) => {
    const isEditMode = useMemo(() => !!loteToEdit, [loteToEdit]);
    
    const [productoId, setProductoId] = useState<string>('');
    const [cantidad, setCantidad] = useState(0);
    const [numeroLote, setNumeroLote] = useState('');
    const [fechaVencimiento, setFechaVencimiento] = useState('');
    const [costoLaboratorio, setCostoLaboratorio] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditMode && loteToEdit) {
            setProductoId(productoDeLote?.id || '');
            setCantidad(loteToEdit.cantidad_inicial);
            setNumeroLote(loteToEdit.numero_lote);
            setFechaVencimiento(loteToEdit.fecha_vencimiento ? new Date(loteToEdit.fecha_vencimiento).toISOString().split('T')[0] : '');
            setCostoLaboratorio(loteToEdit.costo_laboratorio);
        } else if (productos.length > 0) {
            setProductoId(productos[0].id);
        }
    }, [loteToEdit, isEditMode, productoDeLote, productos]);

    const resetAndClose = () => {
        setError(null);
        setIsSubmitting(false);
        setCantidad(0);
        setNumeroLote('');
        setFechaVencimiento('');
        setCostoLaboratorio(0);
        if (productos.length > 0) setProductoId(productos[0].id);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!productoId && !isEditMode) || cantidad <= 0 || !numeroLote) {
            setError('Producto, cantidad y número de lote son requeridos.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            if (isEditMode && loteToEdit) {
                await updateProduction({
                    loteId: loteToEdit.id,
                    cantidadInicial: cantidad,
                    numeroLote,
                    fechaVencimiento,
                    costoLaboratorio,
                });
            } else {
                 await registerProduction({
                    productoId,
                    cantidadProducida: cantidad,
                    numeroLote,
                    fechaVencimiento,
                    costoLaboratorio,
                });
            }
           
            onSuccess();
            resetAndClose();
        } catch (err: any) {
            setError(`Error al guardar: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {isEditMode ? 'Editar Producción' : 'Registrar Nueva Producción'}
                    </h3>
                    <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
                    
                    <div>
                        <label htmlFor="productoId" className="block text-sm font-medium text-gray-700 mb-1">Producto Terminado</label>
                        <select
                            id="productoId"
                            value={productoId}
                            onChange={(e) => setProductoId(e.target.value)}
                            required
                            disabled={isEditMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary disabled:bg-gray-100"
                        >
                            {isEditMode && productoDeLote ? (
                                <option value={productoDeLote.id}>{productoDeLote.nombre}</option>
                            ) : (
                                productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)
                            )}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700 mb-1">Cantidad Producida</label>
                            <input type="number" name="cantidad" id="cantidad" value={cantidad} onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)} required min="1" step="1" className="w-full input-style" />
                        </div>
                        <div>
                            <label htmlFor="numeroLote" className="block text-sm font-medium text-gray-700 mb-1">Número de Lote</label>
                            <input type="text" name="numeroLote" id="numeroLote" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} required className="w-full input-style" />
                        </div>
                        <div>
                            <label htmlFor="fechaVencimiento" className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                            <input type="date" name="fechaVencimiento" id="fechaVencimiento" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="w-full input-style" />
                        </div>
                         <div>
                            <label htmlFor="costoLaboratorio" className="block text-sm font-medium text-gray-700 mb-1">Costo Laboratorio (Total Lote)</label>
                            <input type="number" name="costoLaboratorio" id="costoLaboratorio" value={costoLaboratorio} onChange={(e) => setCostoLaboratorio(parseFloat(e.target.value) || 0)} min="0" step="0.01" className="w-full input-style" />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-6">
                        <button type="button" onClick={resetAndClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300 transition-colors">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Registrar Producción')}
                        </button>
                    </div>
                </form>
            </div>
             <style>{`.input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #8a5cf6; }`}</style>
        </div>
    );
};

// --- Main Stock Page Component ---
const Stock: React.FC = () => {
    const { profile } = useAuth();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [simpleProductos, setSimpleProductos] = useState<SimpleProducto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalContent, setModalContent] = useState<'create' | Lote | null>(null);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const canManage = profile?.roles?.some(role => ['superadmin', 'administrativo'].includes(role));
    
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("[StockProductosPage] Fetching all data.");
            const [stockData, simpleProdData] = await Promise.all([
                fetchProductosConStock(),
                fetchSimpleProductos()
            ]);
            setProductos(stockData);
            setSimpleProductos(simpleProdData);
            console.log("[StockProductosPage] All data fetched successfully.");
        } catch (err: any) {
            console.error(`[StockProductosPage] Error fetching data:`, err);
            setError(err.message);
        } finally {
            setLoading(false);
            console.log(`[StockProductosPage] Fetch finished.`);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleModalSuccess = () => {
        setModalContent(null);
        loadData(); // Reload all data to reflect changes
    };
    
    const handleCloseModal = () => {
        setModalContent(null);
    };

    const toggleRow = (productoId: string) => {
        setExpandedRows(prev => ({ ...prev, [productoId]: !prev[productoId] }));
    };
    
    const isEditMode = modalContent && typeof modalContent === 'object';
    const loteToEdit = isEditMode ? modalContent : null;
    const productoDeLote = isEditMode ? simpleProductos.find(p => productos.find(sp => sp.id === p.id)?.lotes.some(l => l.id === loteToEdit.id)) : undefined;


    return (
        <div>
            <PageHeader title="Stock de Productos Terminados">
                {canManage && (
                    <button 
                        onClick={() => setModalContent('create')}
                        className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors"
                    >
                        <IconPlus className="h-5 w-5 mr-2" />
                        Registrar Producción
                    </button>
                )}
            </PageHeader>
            
            <DatabaseErrorDisplay error={error} />

            <div className="bg-surface rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12"></th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Código de Barras</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && <tr><td colSpan={4} className="text-center py-8">Cargando...</td></tr>}
                  {!loading && productos.map(item => (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button onClick={() => toggleRow(item.id)} className="text-gray-500 hover:text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedRows[item.id] ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{item.nombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.codigoBarras || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                           <span className={item.stockTotal < 50 ? 'text-red-600' : 'text-green-700'}>
                             {item.stockTotal} u.
                           </span>
                        </td>
                      </tr>
                      {expandedRows[item.id] && (
                        <tr>
                          <td colSpan={4} className="p-0">
                            <div className="p-4 bg-violet-50">
                               <h4 className="font-semibold text-sm mb-2 pl-2">Desglose de Stock por Depósito</h4>
                               {item.stockPorDeposito.length > 0 ? (
                                <div className="space-y-3">
                                  {item.stockPorDeposito.map(deposito => (
                                      <div key={deposito.depositoId} className="bg-white p-3 rounded-md shadow-sm">
                                          <div className="flex justify-between items-center">
                                              <span className="font-bold text-primary">{deposito.depositoNombre}</span>
                                              <span className="text-sm font-semibold">{deposito.stock} u.</span>
                                          </div>
                                          <ul className="text-xs space-y-2 mt-2 pl-2 border-l-2 border-gray-200">
                                            {deposito.lotes.map(l => (
                                                <li key={l.id} className="flex items-center justify-between whitespace-nowrap gap-x-4">
                                                   <div>
                                                     Lote <span className="font-mono bg-gray-100 px-1 rounded">{l.numero_lote}</span>: {l.cantidad_actual} / {l.cantidad_inicial} u. (Vence: {l.fecha_vencimiento ? new Date(l.fecha_vencimiento).toLocaleDateString('es-AR') : 'N/A'})
                                                   </div>
                                                   {canManage && (
                                                       <button onClick={() => setModalContent(l)} className="text-blue-500 hover:text-blue-700" title="Editar Producción">
                                                           <IconPencil className="h-4 w-4" />
                                                       </button>
                                                   )}
                                                </li>
                                            ))}
                                          </ul>
                                      </div>
                                  ))}
                                </div>
                               ) : <p className="text-sm text-gray-500 pl-2">Sin stock en ningún depósito.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>


            {!!modalContent && (
                <ProductionModal 
                    onClose={handleCloseModal}
                    onSuccess={handleModalSuccess}
                    productos={simpleProductos}
                    loteToEdit={loteToEdit}
                    productoDeLote={productoDeLote}
                />
            )}
        </div>
    );
};

export default Stock;
