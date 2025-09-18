import React, { useState, useEffect, useMemo } from 'react';
import { Insumo, InsumoCategoria, SimpleProducto } from '../types';
import { createInsumo, updateInsumo, fetchInsumoWithDetails } from '../services/insumosService';
import { fetchSimpleProductos } from '../services/productosService';
import { IconX } from './Icons';

interface InsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  insumoToEdit?: Insumo | null;
}

const initialFormState: Partial<Insumo> = {
    nombre: '',
    proveedor: '',
    categoria: 'OTRO',
    costo: 0,
    stock: 0,
    unidad: 'unidades',
};

const InsumoModal: React.FC<InsumoModalProps> = ({ isOpen, onClose, onSuccess, insumoToEdit }) => {
    const [formData, setFormData] = useState<Partial<Insumo>>(initialFormState);
    const [productos, setProductos] = useState<SimpleProducto[]>([]);
    const [selectedProductos, setSelectedProductos] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditMode = useMemo(() => !!insumoToEdit, [insumoToEdit]);

    useEffect(() => {
        if (!isOpen) {
            // Reset state completely on close
            setFormData(initialFormState);
            setSelectedProductos([]);
            setSearchTerm('');
            setError(null);
            setIsSubmitting(false);
            setIsLoadingData(false);
            return;
        }

        const loadInitialData = async () => {
            setIsLoadingData(true);
            try {
                const data = await fetchSimpleProductos();
                setProductos(data);

                if (isEditMode && insumoToEdit) {
                    const { insumo: detailedInsumo, productoIds } = await fetchInsumoWithDetails(insumoToEdit.id);
                    setFormData({
                        nombre: detailedInsumo.nombre,
                        proveedor: detailedInsumo.proveedor,
                        categoria: detailedInsumo.categoria,
                        costo: detailedInsumo.costo,
                        unidad: detailedInsumo.unidad,
                        // Stock is not editable here
                    });
                    setSelectedProductos(productoIds);
                }
            } catch (err: any) {
                setError(`No se pudieron cargar los datos iniciales: ${err.message}`);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadInitialData();
    }, [isOpen, isEditMode, insumoToEdit]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumericField = ['costo', 'stock'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumericField ? parseFloat(value) || 0 : value }));
    };

    const handleProductToggle = (productId: string) => {
        setSelectedProductos(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre || !formData.categoria) {
            setError('El nombre y la categoría son campos requeridos.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            if (isEditMode && insumoToEdit) {
                await updateInsumo(insumoToEdit.id, formData, selectedProductos);
            } else {
                await createInsumo(formData, selectedProductos);
            }
            onSuccess();
        } catch (err: any) {
            setError(`Error al guardar el insumo: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const filteredProductos = useMemo(() =>
        productos.filter(p =>
            p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        ), [productos, searchTerm]
    );

    if (!isOpen) return null;

    const categorias: InsumoCategoria[] = ['ENVASE', 'ETIQUETA', 'VALVULA', 'CAJA', 'MATERIAL ESPECIAL', 'OTRO'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-full flex flex-col">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">{isEditMode ? 'Editar Insumo' : 'Crear Nuevo Insumo'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>

                {isLoadingData ? (
                    <div className="p-6 text-center">Cargando datos...</div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre Insumo</label>
                                <input type="text" name="nombre" id="nombre" value={formData.nombre} onChange={handleInputChange} required className="w-full input-style" />
                            </div>
                            <div>
                                <label htmlFor="proveedor" className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                                <input type="text" name="proveedor" id="proveedor" value={formData.proveedor || ''} onChange={handleInputChange} className="w-full input-style" />
                            </div>
                            <div>
                                <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select name="categoria" id="categoria" value={formData.categoria} onChange={handleInputChange} className="w-full input-style">
                                    {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="costo" className="block text-sm font-medium text-gray-700 mb-1">Costo (ARS)</label>
                                <input type="number" name="costo" id="costo" value={formData.costo} onChange={handleInputChange} min="0" step="0.01" className="w-full input-style" />
                            </div>
                            <div>
                                <label htmlFor="unidad" className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida</label>
                                <select name="unidad" id="unidad" value={formData.unidad} onChange={handleInputChange} className="w-full input-style">
                                    <option value="unidades">Unidades</option>
                                    <option value="gramos">Gramos</option>
                                    <option value="ml">Mililitros (ml)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                                <input type="number" name="stock" id="stock" value={formData.stock} onChange={handleInputChange} min="0" step="1" className="w-full input-style" disabled={isEditMode} title={isEditMode ? 'El stock se actualiza con la acción de Registrar Compra' : ''} />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a Productos Finales</label>
                            <div className="border border-gray-300 rounded-md p-2">
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full input-style mb-2"
                                />
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                    {filteredProductos.length > 0 ? filteredProductos.map(p => (
                                        <label key={p.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedProductos.includes(p.id)}
                                                onChange={() => handleProductToggle(p.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm text-gray-800">{p.nombre}</span>
                                        </label>
                                    )) : <p className="text-sm text-gray-500 text-center p-2">No se encontraron productos.</p>}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{selectedProductos.length} producto(s) seleccionado(s).</p>
                        </div>

                        <div className="flex justify-end pt-4 border-t mt-6">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300 transition-colors">Cancelar</button>
                            <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300 disabled:cursor-not-allowed">
                                {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Guardar Insumo')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
             <style>{`
                .input-style {
                    display: block;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                    border: 1px solid #D1D5DB;
                    border-radius: 0.375rem;
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                }
                .input-style:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    --tw-ring-color: #8a5cf6;
                    border-color: #8a5cf6;

                }
                .input-style:disabled {
                    background-color: #F3F4F6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default InsumoModal;
