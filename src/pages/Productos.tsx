import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Table, { Column } from '../components/Table';
import { Producto } from '../types';
import { IconPackage, IconPlus, IconX, IconCamera, IconPencil, IconTrash, IconChartBar } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { fetchProductosConStock, createProducto, updateProducto, deleteProducto } from '../services/productosService';
import BarcodeScanner from '../components/BarcodeScanner';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

const Productos: React.FC = () => {
    const { profile } = useAuth();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // FIX: Add new dynamic pricing fields to the initial state.
    const initialProductoState: Partial<Producto> = {
        nombre: '',
        codigoBarras: '',
        precioPublico: 0,
        precioComercio: 0,
        precioMayorista: 0,
        descripcion: '',
        linea: 'General',
        cantidadMinimaComercio: 3,
        cantidadMinimaMayorista: 6,
        boxLengthCm: 0,
        boxWidthCm: 0,
        boxHeightCm: 0,
        productWeightKg: 0,
        productsPerBox: 0,
    };
    const [currentProducto, setCurrentProducto] = useState<Partial<Producto>>(initialProductoState);
    const [editingProductoId, setEditingProductoId] = useState<string | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<any | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const canManage = profile?.roles?.some(role => ['superadmin', 'administrativo'].includes(role));

    useEffect(() => {
        loadProductos();
    }, []);
    
    const loadProductos = async () => {
        console.log("[ProductosPage] Mounting and fetching data.");
        setLoading(true);
        setError(null);
        try {
            const data = await fetchProductosConStock();
            setProductos(data);
            console.log("[ProductosPage] Data fetched successfully.", data);
        } catch (error: any) {
            console.error("[ProductosPage] Failed to fetch data:", error.message);
            setError(error);
        } finally {
            setLoading(false);
            console.log("[ProductosPage] Fetch process finished.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumericField = ['precioPublico', 'precioComercio', 'precioMayorista', 'cantidadMinimaComercio', 'cantidadMinimaMayorista', 'boxLengthCm', 'boxWidthCm', 'boxHeightCm', 'productWeightKg', 'productsPerBox'].includes(name);
        setCurrentProducto(prev => ({ ...prev, [name]: isNumericField ? parseFloat(value) || 0 : value }));
    };

    const resetModal = () => {
        setIsModalOpen(false);
        setEditingProductoId(null);
        setCurrentProducto(initialProductoState);
        setSelectedFile(null);
        setImagePreview(null);
        setError(null);
        setIsSubmitting(false);
    };
    
    const handleEdit = (producto: Producto) => {
        setEditingProductoId(producto.id);
        // FIX: Include new dynamic pricing fields when setting state for an edit.
        setCurrentProducto({
            nombre: producto.nombre,
            codigoBarras: producto.codigoBarras,
            precioPublico: producto.precioPublico,
            precioComercio: producto.precioComercio,
            precioMayorista: producto.precioMayorista,
            descripcion: producto.descripcion,
            linea: producto.linea,
            cantidadMinimaComercio: producto.cantidadMinimaComercio,
            cantidadMinimaMayorista: producto.cantidadMinimaMayorista,
            boxLengthCm: producto.boxLengthCm,
            boxWidthCm: producto.boxWidthCm,
            boxHeightCm: producto.boxHeightCm,
            productWeightKg: producto.productWeightKg,
            productsPerBox: producto.productsPerBox,
        });
        setImagePreview(producto.imagenUrl);
        setIsModalOpen(true);
    };

    const handleDelete = async (productoId: string) => {
        if(window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.')) {
            try {
                await deleteProducto(productoId);
                setProductos(prev => prev.filter(p => p.id !== productoId));
            } catch (err: any) {
                console.error("Failed to delete product:", err);
                setError(err);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentProducto.nombre || (currentProducto.precioPublico ?? 0) <= 0) {
            setError({ message: "El nombre y un precio público válido son requeridos."});
            return;
        }
        setIsSubmitting(true);
        setError(null);

        try {
            if (editingProductoId) {
                const updated = await updateProducto(editingProductoId, currentProducto, selectedFile);
                setProductos(prev => prev.map(p => p.id === editingProductoId ? updated : p));
            } else {
                const created = await createProducto(currentProducto, selectedFile);
                setProductos(prev => [created, ...prev]);
            }
            resetModal();
        } catch (err: any) {
            console.error("Failed to save product:", err);
            setError(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleScanSuccess = (result: string) => {
        setCurrentProducto(prev => ({ ...prev, codigoBarras: result }));
        setIsScannerOpen(false);
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`;

    const columns: Column<Producto>[] = [
        { header: 'Imagen', accessor: 'imagenUrl', render: (item) => (
            item.imagenUrl ? 
            <img src={item.imagenUrl} alt={item.nombre} className="h-10 w-10 rounded-full object-cover" /> :
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                <IconPackage className="h-5 w-5 text-gray-500" />
            </div>
        )},
        { header: 'Nombre', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Código de Barras', accessor: 'codigoBarras' },
        { header: 'Stock Total', accessor: 'stockTotal', render: (item) => (
            <span className={item.stockTotal < 50 ? 'text-red-600 font-bold' : 'text-gray-700'}>{item.stockTotal}</span>
        )},
        // FIX: Update price column to display minimum quantities for dynamic pricing.
        { header: 'Precios (P/C/M)', accessor: 'precioPublico', render: (item) => (
            <div className="text-xs">
                <div>P: <span className="font-semibold">{formatPrice(item.precioPublico)}</span></div>
                <div>C: <span className="font-semibold">{formatPrice(item.precioComercio)}</span> (min. {item.cantidadMinimaComercio || 'N/A'})</div>
                <div>M: <span className="font-semibold">{formatPrice(item.precioMayorista)}</span> (min. {item.cantidadMinimaMayorista || 'N/A'})</div>
            </div>
        )},
        { header: 'Acciones', accessor: 'id', render: (item) => (
            <div className="flex space-x-3 items-center">
                 <Link to={`/productos/${item.id}/dashboard`} className="text-gray-500 hover:text-primary" title="Ver Dashboard">
                    <IconChartBar className="h-5 w-5" />
                </Link>
                {canManage && (
                    <>
                        <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar">
                            <IconPencil className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700" title="Eliminar">
                            <IconTrash className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>
        )}
    ];

    const productLines = ['General', 'ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS'];

    const filteredProductos = useMemo(() =>
        productos.filter(producto => {
            const search = searchTerm.toLowerCase();
            return (
                (producto.nombre?.toLowerCase() || '').includes(search) ||
                (producto.codigoBarras?.toLowerCase() || '').includes(search)
            );
        }),
        [productos, searchTerm]
    );

    return (
        <div>
            <PageHeader title="Productos">
                {canManage && (
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nuevo Producto
                    </button>
                )}
            </PageHeader>
            
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre o código de barras..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                />
            </div>
            
            <DatabaseErrorDisplay error={error} />
            <Table columns={columns} data={filteredProductos} isLoading={loading} />
            
            {isScannerOpen && <BarcodeScanner onScan={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-full overflow-y-auto">
                        <div className="flex justify-between items-center p-5 border-b">
                            <h3 className="text-xl font-semibold text-gray-800">{editingProductoId ? 'Editar Producto' : 'Crear Nuevo Producto'}</h3>
                            <button onClick={resetModal} className="text-gray-400 hover:text-gray-600">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && <DatabaseErrorDisplay error={error} />}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                                    <input type="text" name="nombre" id="nombre" value={currentProducto.nombre || ''} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label htmlFor="codigoBarras" className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                                    <div className="relative">
                                        <input type="text" name="codigoBarras" id="codigoBarras" value={currentProducto.codigoBarras || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary pr-10" />
                                        <button type="button" onClick={() => setIsScannerOpen(true)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-primary transition-colors">
                                            <IconCamera className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="precioPublico" className="block text-sm font-medium text-gray-700 mb-1">Precio Público</label>
                                    <input type="number" name="precioPublico" id="precioPublico" value={currentProducto.precioPublico || 0} onChange={handleInputChange} required min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label htmlFor="precioComercio" className="block text-sm font-medium text-gray-700 mb-1">Precio Comercio</label>
                                    <input type="number" name="precioComercio" id="precioComercio" value={currentProducto.precioComercio || 0} onChange={handleInputChange} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label htmlFor="precioMayorista" className="block text-sm font-medium text-gray-700 mb-1">Precio Mayorista</label>
                                    <input type="number" name="precioMayorista" id="precioMayorista" value={currentProducto.precioMayorista || 0} onChange={handleInputChange} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                            </div>
                            {/* FIX: Add inputs for dynamic pricing minimum quantities. */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 <div>
                                    <label htmlFor="linea" className="block text-sm font-medium text-gray-700 mb-1">Línea de Producto</label>
                                    <select name="linea" id="linea" value={currentProducto.linea || 'General'} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary">
                                        {productLines.map(line => <option key={line} value={line}>{line}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="cantidadMinimaComercio" className="block text-sm font-medium text-gray-700 mb-1">Cant. Mín. Comercio</label>
                                    <input type="number" name="cantidadMinimaComercio" id="cantidadMinimaComercio" value={currentProducto.cantidadMinimaComercio || 0} onChange={handleInputChange} min="0" step="1" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label htmlFor="cantidadMinimaMayorista" className="block text-sm font-medium text-gray-700 mb-1">Cant. Mín. Mayorista</label>
                                    <input type="number" name="cantidadMinimaMayorista" id="cantidadMinimaMayorista" value={currentProducto.cantidadMinimaMayorista || 0} onChange={handleInputChange} min="0" step="1" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <textarea name="descripcion" id="descripcion" value={currentProducto.descripcion || ''} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Imagen del Producto</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Vista previa" className="mx-auto h-24 w-24 object-cover rounded-md" />
                                        ) : (
                                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 4v.01M28 8l-6-6-6 6M28 8v12a4 4 0 01-4 4H12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        )}
                                        <div className="flex text-sm text-gray-600 justify-center">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                                                <span>{selectedFile ? 'Cambiar imagen' : 'Subir un archivo'}</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">PNG, JPG, WEBP hasta 5MB</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 mt-4 border-t">
                                <h4 className="text-md font-semibold text-gray-700 mb-2">Datos de Logística (COMEX)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="productsPerBox" className="block text-sm font-medium text-gray-700">Prod. por Caja</label>
                                        <input type="number" name="productsPerBox" id="productsPerBox" value={currentProducto.productsPerBox || 0} onChange={handleInputChange} min="0" step="1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <label htmlFor="productWeightKg" className="block text-sm font-medium text-gray-700">Peso Prod. (kg)</label>
                                        <input type="number" name="productWeightKg" id="productWeightKg" value={currentProducto.productWeightKg || 0} onChange={handleInputChange} min="0" step="0.01" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <label htmlFor="boxLengthCm" className="block text-sm font-medium text-gray-700">Largo Caja (cm)</label>
                                        <input type="number" name="boxLengthCm" id="boxLengthCm" value={currentProducto.boxLengthCm || 0} onChange={handleInputChange} min="0" step="0.1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <label htmlFor="boxWidthCm" className="block text-sm font-medium text-gray-700">Ancho Caja (cm)</label>
                                        <input type="number" name="boxWidthCm" id="boxWidthCm" value={currentProducto.boxWidthCm || 0} onChange={handleInputChange} min="0" step="0.1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <label htmlFor="boxHeightCm" className="block text-sm font-medium text-gray-700">Alto Caja (cm)</label>
                                        <input type="number" name="boxHeightCm" id="boxHeightCm" value={currentProducto.boxHeightCm || 0} onChange={handleInputChange} min="0" step="0.1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t mt-6">
                                <button type="button" onClick={resetModal} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300 transition-colors">Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300 disabled:cursor-not-allowed">
                                    {isSubmitting ? 'Guardando...' : (editingProductoId ? 'Guardar Cambios' : 'Guardar Producto')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;
