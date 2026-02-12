
import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Producto } from '../types';
import { fetchProductosConStock } from '../services/productosService';
import { createListaConProductos } from '../services/preciosService';
import { IconPackage, IconDeviceFloppy, IconX } from '../components/Icons';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

type ListaType = 'CLIENTE' | 'COMERCIO' | 'MAYORISTA';

const getDefaultLoteMinimo = (listaType: ListaType, producto: Producto): number => {
    switch (listaType) {
        // FIX: Add default values to prevent errors if properties are null/undefined.
        case 'MAYORISTA': return producto.cantidadMinimaMayorista || 6;
        case 'COMERCIO': return producto.cantidadMinimaComercio || 3;
        case 'CLIENTE':
        default:
            return 1;
    }
};

const Precios: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [listaSeleccionada, setListaSeleccionada] = useState<ListaType>('COMERCIO');
    const [isDownloading, setIsDownloading] = useState(false);
    const [editedLotes, setEditedLotes] = useState<Record<string, number>>({});
    const pdfRef = useRef<HTMLDivElement>(null);
    
    // State for the new "Save List" modal
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);


    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchProductosConStock();
                setProductos(data);
            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);
    
    const handleLoteChange = (productoId: string, value: string) => {
        const newLote = parseInt(value, 10);
        if (!isNaN(newLote) && newLote >= 0) {
            setEditedLotes(prev => ({
                ...prev,
                [productoId]: newLote,
            }));
        }
    };

    const getPrecioForSelectedList = (producto: Producto): number => {
        switch (listaSeleccionada) {
            case 'CLIENTE': return producto.precioPublico;
            case 'COMERCIO': return producto.precioComercio;
            case 'MAYORISTA': return producto.precioMayorista;
            default: return 0;
        }
    };
    
    const groupedProducts = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        
        const grouped = productos.reduce((acc, producto) => {
            const linea = producto.linea || 'General';
            if (!acc[linea]) {
                acc[linea] = [];
            }
            acc[linea].push(producto);
            return acc;
        }, {} as Record<string, Producto[]>);

        const sortedGroup: Record<string, Producto[]> = {};
        for (const line of lineOrder) {
            if (grouped[line]) {
                sortedGroup[line] = grouped[line];
            }
        }
        for (const line in grouped) {
            if (!sortedGroup[line]) {
                sortedGroup[line] = grouped[line];
            }
        }

        return sortedGroup;

    }, [productos]);

    const handleDownloadPDF = async () => {
        const content = pdfRef.current;
        if (!content) return;

        setIsDownloading(true);
        try {
            const canvas = await html2canvas(content, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            pdf.save(`Lista_Precios_${listaSeleccionada}_${new Date().toLocaleDateString('es-AR')}.pdf`);

        } catch (err) {
            console.error("Error generating PDF:", err);
            setError({ message: "No se pudo generar el PDF." });
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleCreateNewList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newListName.trim()) {
            setError({ message: "El nombre de la lista es requerido." });
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const productosParaGuardar = productos.map(p => ({
                productoId: p.id,
                precio: getPrecioForSelectedList(p)
            }));

            await createListaConProductos(newListName.trim(), productosParaGuardar);
            
            setIsSaveModalOpen(false);
            setNewListName('');
            setSuccessMessage(`Lista "${newListName.trim()}" creada con éxito. Ahora puede ser asignada a clientes.`);
            setTimeout(() => setSuccessMessage(null), 5000); // Hide message after 5 seconds

        } catch (err: any) {
            setError(err); // The modal will display this error
        } finally {
            setIsSaving(false);
        }
    };


    const formatPrice = (price: number) => {
        return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (loading) return <div className="p-8 text-center">Cargando lista de precios...</div>;

    const lineaColors: Record<string, string> = {
        'ULTRAHISNE': 'bg-orange-500',
        'BODYTAN CARIBEAN': 'bg-yellow-800',
        'SECRET': 'bg-gray-800',
        'ESSENS': 'bg-blue-300',
        'General': 'bg-gray-500',
    };

    return (
        <div>
            <div className="p-4 bg-gray-100 mb-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <label htmlFor="lista-select" className="font-semibold">Seleccionar Lista:</label>
                    <select
                        id="lista-select"
                        value={listaSeleccionada}
                        onChange={(e) => setListaSeleccionada(e.target.value as ListaType)}
                        className="p-2 border border-gray-300 rounded-md"
                    >
                        <option value="COMERCIO">Comercio</option>
                        <option value="MAYORISTA">Mayorista</option>
                        <option value="CLIENTE">Cliente (Público)</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSaveModalOpen(true)}
                        className="w-full sm:w-auto bg-green-500 text-white px-6 py-2 rounded-lg shadow hover:bg-green-600 transition-colors flex items-center"
                    >
                         <IconDeviceFloppy className="h-5 w-5 mr-2" />
                        Guardar como Nueva Lista
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full sm:w-auto bg-primary text-white px-6 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300 disabled:cursor-wait"
                    >
                        {isDownloading ? 'Generando PDF...' : 'Descargar como PDF'}
                    </button>
                </div>
            </div>

            <DatabaseErrorDisplay error={error} />
            {successMessage && (
                 <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
                    <p>{successMessage}</p>
                </div>
            )}

            <div ref={pdfRef} className="p-8 bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                <header className="text-center mb-10">
                    <h1 className="text-5xl font-extrabold text-gray-800 tracking-wider">ISABELLA</h1>
                    <p className="text-xl text-gray-500">De la Perla</p>
                </header>

                {Object.entries(groupedProducts).map(([linea, prods]) => (
                    <div key={linea} className="mb-12" style={{ breakInside: 'avoid' }}>
                        <div className={`p-4 text-white text-center rounded-t-lg ${lineaColors[linea] || 'bg-gray-500'}`}>
                            <h2 className="text-3xl font-bold tracking-widest uppercase">{linea === 'ESSENS' ? 'ESSENCE' : linea}</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-l border-r border-b border-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Imagen</th>
                                        <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[40%]">Detalle</th>
                                        <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Lote Mín.</th>
                                        <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Cód. Barras</th>
                                        <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Compra Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {(prods as Producto[]).map(producto => {
                                        const precioUnitario = getPrecioForSelectedList(producto);
                                        const defaultLote = getDefaultLoteMinimo(listaSeleccionada, producto);
                                        const currentLote = editedLotes[producto.id] ?? defaultLote;
                                        const compraTotal = precioUnitario * currentLote;
                                        return (
                                            <tr key={producto.id}>
                                                <td className="p-4 align-middle text-center">
                                                    <div>
                                                        {producto.imagenUrl ? (
                                                            <img src={producto.imagenUrl} alt={producto.nombre} className="h-20 w-20 object-contain mx-auto" />
                                                        ) : (
                                                            <div className="h-20 w-20 bg-gray-100 flex items-center justify-center rounded mx-auto">
                                                                <IconPackage className="h-8 w-8 text-gray-400" />
                                                            </div>
                                                        )}
                                                        <p className="font-bold text-lg text-primary mt-2">{formatPrice(precioUnitario)}</p>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <p className="font-bold text-base text-gray-800">{producto.nombre}</p>
                                                    <p className="text-gray-600">{producto.descripcion}</p>
                                                </td>
                                                <td className="p-4 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        value={currentLote}
                                                        onChange={(e) => handleLoteChange(producto.id, e.target.value)}
                                                        className="w-20 text-center font-semibold text-gray-800 border-2 border-gray-200 rounded-md p-2 focus:ring-primary focus:border-primary transition"
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="p-4 text-center align-middle font-mono text-gray-600">{producto.codigoBarras || 'N/A'}</td>
                                                <td className="p-4 text-right align-middle font-bold text-lg text-gray-800">{formatPrice(compraTotal)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                 <footer className="text-center mt-12 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 font-semibold">www.isabelladelaperla.com</p>
                    <p className="text-xs text-gray-500">Contacto: contacto@isabelladelaperla.com</p>
                </footer>
            </div>
            
            {isSaveModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center p-5 border-b">
                            <h3 className="text-xl font-semibold text-gray-800">Guardar como Nueva Lista</h3>
                            <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-gray-600"><IconX className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleCreateNewList} className="p-6 space-y-4">
                            <DatabaseErrorDisplay error={error} />
                             <div>
                                <label htmlFor="newListName" className="block text-sm font-medium text-gray-700 mb-1">Nombre para la Nueva Lista</label>
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
                                <button type="button" onClick={() => setIsSaveModalOpen(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300">Cancelar</button>
                                <button type="submit" disabled={isSaving} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark disabled:bg-violet-300">
                                    {isSaving ? 'Guardando...' : 'Guardar Lista'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Precios;
