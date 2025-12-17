import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { IconArrowLeft, IconPlus, IconTrash, IconFileText, IconCamera } from '../components/Icons';
import { SimpleCliente, Producto, VentaItem, Lote, PuntoDeVenta } from '../types';
import { VentaToCreate, createVenta, VentaItemParaCrear } from '../services/ventasService';
import { fetchSimpleClientes } from '../services/clientesService';
import { fetchProductosConStock } from '../services/productosService';
import { fetchLotesParaVenta } from '../services/stockService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import BarcodeScanner from '../components/BarcodeScanner';

const IVA_RATE = 0.21;

// Extends VentaItem for UI state management
interface VentaItemUI extends VentaItem {
    depositoId: string;
}

const CrearVenta: React.FC = () => {
    const navigate = useNavigate();
    const [clientes, setClientes] = useState<SimpleCliente[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedClienteId, setSelectedClienteId] = useState<string>('');
    const [items, setItems] = useState<VentaItemUI[]>([]);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [tipo, setTipo] = useState<'Venta' | 'Consignacion'>('Venta');
    const [puntoDeVenta, setPuntoDeVenta] = useState<PuntoDeVenta>('Tienda física');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [observaciones, setObservaciones] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [aplicarIva, setAplicarIva] = useState(true);

    const selectedCliente = useMemo(() => clientes.find(c => c.id === selectedClienteId), [clientes, selectedClienteId]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [clientesData, productosData] = await Promise.all([
                    fetchSimpleClientes(),
                    fetchProductosConStock()
                ]);
                const consumidorFinal = {
                    id: '',
                    nombre: 'Consumidor Final',
                    telefono: null,
                    email: null,
                    listaPrecioNombre: 'Público',
                    direccion: null,
                    localidad: null,
                    provincia: null,
                };
                setClientes([consumidorFinal, ...clientesData]);
                setProductos(productosData);
                setSelectedClienteId(''); // Default to Consumidor Final
            } catch (err: any) {
                setError(`Error al cargar datos: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const getPriceForProduct = (product: Producto, client?: SimpleCliente) => {
        const buyerType = client?.listaPrecioNombre || 'Público';
        if (buyerType.toLowerCase().includes('mayorista')) return product.precioMayorista;
        if (buyerType.toLowerCase().includes('comercio')) return product.precioComercio;
        return product.precioPublico;
    };

    const handleAddItem = () => {
        const firstAvailableProduct = productos.find(p => p.stockTotal > 0);
        if (!firstAvailableProduct) {
            alert('No hay productos con stock disponible para agregar.');
            return;
        }
        const firstDepositoWithStock = firstAvailableProduct.stockPorDeposito.find(d => d.stock > 0);

        setItems(prev => [...prev, {
            productoId: firstAvailableProduct.id,
            cantidad: 1,
            precioUnitario: getPriceForProduct(firstAvailableProduct, selectedCliente),
            productoNombre: firstAvailableProduct.nombre,
            depositoId: firstDepositoWithStock?.depositoId || ''
        }]);
    };
    
    const handleScanSuccess = (scannedCode: string) => {
        setIsScannerOpen(false);
        const product = productos.find(p => p.codigoBarras === scannedCode);

        if (product) {
             if (product.stockTotal <= 0) {
                alert(`El producto "${product.nombre}" no tiene stock disponible.`);
                return;
            }
            const firstDepositoWithStock = product.stockPorDeposito.find(d => d.stock > 0);
            if (!firstDepositoWithStock) {
                 alert(`El producto "${product.nombre}" no tiene stock disponible en ningún depósito.`);
                 return;
            }

            const existingItemIndex = items.findIndex(item => item.productoId === product.id && item.depositoId === firstDepositoWithStock.depositoId);
            if (existingItemIndex > -1) {
                const newItems = [...items];
                const currentItem = newItems[existingItemIndex];
                if (currentItem.cantidad < firstDepositoWithStock.stock) {
                    currentItem.cantidad += 1;
                    setItems(newItems);
                } else {
                    alert(`No se puede agregar más. Stock máximo alcanzado para "${product.nombre}" en el depósito "${firstDepositoWithStock.depositoNombre}".`);
                }
            } else {
                const newItem: VentaItemUI = {
                    productoId: product.id,
                    cantidad: 1,
                    precioUnitario: getPriceForProduct(product, selectedCliente),
                    productoNombre: product.nombre,
                    depositoId: firstDepositoWithStock.depositoId,
                };
                setItems(prev => [...prev, newItem]);
            }
        } else {
            alert('Producto no encontrado. Asegúrate de que el código de barras está registrado.');
        }
    };

    const handleItemChange = (index: number, field: keyof VentaItemUI, value: any) => {
        const newItems = [...items];
        const currentItem = newItems[index];
        const product = productos.find(p => p.id === currentItem.productoId);

        switch (field) {
            case 'productoId':
                const newProduct = productos.find(p => p.id === value);
                if (newProduct) {
                    const firstDepositoWithStock = newProduct.stockPorDeposito.find(d => d.stock > 0);
                    currentItem.productoId = value;
                    currentItem.productoNombre = newProduct.nombre;
                    currentItem.precioUnitario = getPriceForProduct(newProduct, selectedCliente);
                    currentItem.cantidad = 1;
                    currentItem.depositoId = firstDepositoWithStock?.depositoId || '';
                }
                break;
            case 'depositoId':
                currentItem.depositoId = value;
                currentItem.cantidad = 1; // Reset quantity on deposit change
                break;
            case 'cantidad':
                const newQuantity = parseInt(value, 10);
                if (isNaN(newQuantity) || newQuantity < 1) {
                    currentItem.cantidad = 1;
                    setItems(newItems);
                    return;
                }
                
                const stockInDeposito = product?.stockPorDeposito.find(d => d.depositoId === currentItem.depositoId)?.stock || 0;
                if (newQuantity > stockInDeposito) {
                    alert(`Stock insuficiente. Solo quedan ${stockInDeposito} unidades de ${product?.nombre} en este depósito.`);
                    currentItem.cantidad = stockInDeposito > 0 ? stockInDeposito : 1;
                } else {
                     currentItem.cantidad = newQuantity;
                }
                break;
        }

        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const { subtotal, iva, total } = useMemo(() => {
        const sub = items.reduce((acc, item) => acc + (item.cantidad * item.precioUnitario), 0);
        const ivaRate = aplicarIva ? IVA_RATE : 0;
        const ivaAmount = sub * ivaRate;
        const totalAmount = sub + ivaAmount;
        return { subtotal: sub, iva: ivaAmount, total: totalAmount };
    }, [items, aplicarIva]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            setError('Debe agregar al menos un producto.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const itemsParaCrear: VentaItemParaCrear[] = [];
            
            for (const item of items) {
                if (!item.depositoId) {
                    throw new Error(`Debe seleccionar un depósito para el producto "${item.productoNombre}".`);
                }

                // 1. Fetch ALL lots (no server-side filtering) to debug status
                const allLotes = await fetchLotesParaVenta(item.productoId, item.depositoId);
                
                // DEBUG LOGS
                console.log(`[CrearVenta] All lots for product ${item.productoNombre} (ID: ${item.productoId}):`, allLotes);

                // 2. Strict client-side filtering. 
                // We map to floor first, then filter. This handles cases where DB has 0.9999.
                const usableLotes = allLotes
                    .map(l => ({...l, cantidad_actual: Math.floor(l.cantidad_actual)}))
                    .filter(l => l.cantidad_actual >= 1);
                
                // DEBUG LOGS
                console.log(`[CrearVenta] Usable lots after filtering (>=1):`, usableLotes);

                // If we found lots but they are all "dust" (0 < quantity < 1), we must block here.
                if (usableLotes.length === 0) {
                     const totalRawStock = allLotes.reduce((sum, l) => sum + l.cantidad_actual, 0);
                     throw new Error(`Stock insuficiente para "${item.productoNombre}". El sistema detecta ${totalRawStock.toFixed(2)} unidades, pero ninguna alcanza la unidad entera mínima requerida (>= 1) para la venta.`);
                }

                const stockInDeposito = usableLotes.reduce((sum, l) => sum + l.cantidad_actual, 0);

                if (item.cantidad > stockInDeposito) {
                    throw new Error(`Stock insuficiente para "${item.productoNombre}" en el depósito seleccionado. Solicitado: ${item.cantidad}, Disponible real: ${stockInDeposito}.`);
                }

                let cantidadRestante = item.cantidad;
                
                // 3. Allocate stock from lots
                for (const lote of usableLotes) {
                    if (cantidadRestante <= 0) break;
                    
                    const cantidadDeLote = Math.min(cantidadRestante, lote.cantidad_actual);
                    
                    if (cantidadDeLote > 0) {
                        itemsParaCrear.push({
                            productoId: item.productoId,
                            cantidad: cantidadDeLote,
                            precioUnitario: item.precioUnitario,
                            loteId: lote.id,
                        });
                        console.log(`[CrearVenta] Allocating ${cantidadDeLote} from lot ${lote.id} (${lote.numero_lote})`);
                        cantidadRestante -= cantidadDeLote;
                    }
                }
                
                if (cantidadRestante > 0) {
                    throw new Error(`Error de asignación de lotes para "${item.productoNombre}". Por favor intente nuevamente.`);
                }
            }

            const ventaData: VentaToCreate = {
                clienteId: selectedClienteId || null,
                fecha,
                tipo,
                estado: 'Pendiente',
                items: itemsParaCrear,
                subtotal,
                iva,
                total,
                observaciones: observaciones.trim() || null,
                puntoDeVenta: puntoDeVenta,
            };

            await createVenta(ventaData);
            navigate('/ventas');
        } catch (err: any) {
            setError(`Error al guardar la venta: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const formatPrice = (price: number) => price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

    if (loading) return <div>Cargando...</div>;
    
    return (
        <div>
            <PageHeader title="Crear Nueva Venta">
                <Link to="/ventas" className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-300 transition-colors">
                    <IconArrowLeft className="h-5 w-5 mr-2" />
                    Volver a Ventas
                </Link>
            </PageHeader>
            <DatabaseErrorDisplay error={error} />

            {isScannerOpen && <BarcodeScanner onScan={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client and Sale Info */}
                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="cliente" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                            <select id="cliente" value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} className="w-full input-style">
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-1">Fecha Pedido</label>
                            <input type="date" id="fecha" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full input-style" />
                        </div>
                        <div>
                            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Venta</label>
                            <select id="tipo" value={tipo} onChange={e => setTipo(e.target.value as any)} className="w-full input-style">
                                <option value="Venta">Venta</option>
                                <option value="Consignacion">Consignación</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="puntoDeVenta" className="block text-sm font-medium text-gray-700 mb-1">Punto de Venta</label>
                            <select id="puntoDeVenta" value={puntoDeVenta} onChange={e => setPuntoDeVenta(e.target.value as PuntoDeVenta)} className="w-full input-style">
                                <option value="Tienda física">Tienda física</option>
                                <option value="Mercado Libre">Mercado Libre</option>
                                <option value="Redes Sociales">Redes Sociales</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                            <textarea
                                id="observaciones"
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                rows={2}
                                className="w-full input-style"
                                placeholder="Añadir notas sobre la venta (ej: detalles de envío, pedido especial, etc.)"
                            />
                        </div>
                    </div>
                    {selectedCliente && selectedCliente.id && ( // Hide for Consumidor Final
                        <div className="mt-6 pt-4 border-t text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-x-6">
                            <p><strong>Tel:</strong> {selectedCliente.telefono || 'N/A'}</p>
                            <p><strong>Mail:</strong> {selectedCliente.email || 'N/A'}</p>
                            <p><strong>Tipo Comprador:</strong> {selectedCliente.listaPrecioNombre}</p>
                            <p className="md:col-span-3"><strong>Dirección:</strong> {`${selectedCliente.direccion || ''}, ${selectedCliente.localidad || ''}, ${selectedCliente.provincia || ''}`}</p>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <div className="bg-surface p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Productos</h3>
                         <button type="button" onClick={() => setIsScannerOpen(true)} className="flex items-center bg-secondary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary-dark transition-colors">
                            <IconCamera className="h-5 w-5 mr-2" />
                            Escanear Producto
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase">
                                    <th className="pb-2 w-2/5">Descripción</th>
                                    <th className="pb-2 w-1/5">Depósito</th>
                                    <th className="pb-2 text-center">Cantidad</th>
                                    <th className="pb-2 text-right">Precio Unit. (SIN IVA)</th>
                                    <th className="pb-2 text-right">Total Línea (SIN IVA)</th>
                                    <th className="pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => {
                                    const producto = productos.find(p => p.id === item.productoId);
                                    const depositosConStock = producto?.stockPorDeposito.filter(d => d.stock > 0) || [];
                                    return (
                                    <tr key={index} className="border-b">
                                        <td>
                                            <select value={item.productoId} onChange={e => handleItemChange(index, 'productoId', e.target.value)} className="w-full input-style-table">
                                                {productos.map(p => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                        disabled={p.stockTotal <= 0}
                                                        className={p.stockTotal <= 0 ? 'text-red-500' : ''}
                                                    >
                                                        {p.nombre} (Stock Total: {p.stockTotal})
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                             <select value={item.depositoId} onChange={e => handleItemChange(index, 'depositoId', e.target.value)} className="w-full input-style-table">
                                                <option value="" disabled>Seleccionar...</option>
                                                {depositosConStock.map(d => (
                                                    <option key={d.depositoId} value={d.depositoId}>
                                                        {d.depositoNombre} ({d.stock} u.)
                                                    </option>
                                                ))}
                                             </select>
                                        </td>
                                        <td>
                                            <input type="number" value={item.cantidad} min="1" onChange={e => handleItemChange(index, 'cantidad', e.target.value)} className="w-20 text-center input-style-table" disabled={!item.depositoId} />
                                        </td>
                                        <td className="text-right py-2 pr-2">{formatPrice(item.precioUnitario)}</td>
                                        <td className="text-right py-2 pr-2 font-semibold">{formatPrice(item.cantidad * item.precioUnitario)}</td>
                                        <td className="text-center">
                                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700">
                                                <IconTrash className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={handleAddItem} className="mt-4 flex items-center text-primary font-semibold text-sm">
                        <IconPlus className="h-4 w-4 mr-1"/> Agregar Producto
                    </button>
                </div>

                {/* Totals and Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                     <div className="w-full md:w-1/3">
                        {/* Placeholder for future actions */}
                     </div>
                     <div className="w-full md:w-1/3 bg-surface p-4 rounded-lg shadow-md space-y-2">
                        <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                        <div className="flex items-center justify-between text-gray-700">
                            <label htmlFor="aplicarIva" className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="aplicarIva"
                                    checked={aplicarIva}
                                    onChange={(e) => setAplicarIva(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="ml-2">Aplicar IVA (21%)</span>
                            </label>
                            <span>{formatPrice(iva)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xl text-on-surface border-t pt-2 mt-2"><span>Total</span><span>{formatPrice(total)}</span></div>
                     </div>
                </div>

                <div className="flex justify-end pt-6 border-t">
                    <button type="submit" disabled={isSubmitting} className="flex items-center bg-primary text-white px-6 py-3 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300">
                        <IconFileText className="h-5 w-5 mr-2" />
                        {isSubmitting ? 'Guardando...' : 'Guardar Venta'}
                    </button>
                </div>
            </form>
            <style>{`
                .input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } 
                .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #8a5cf6; }
                .input-style-table { display: block; width: 100%; padding: 0.5rem; border: 1px solid transparent; border-radius: 0.375rem; }
                .input-style-table:focus, .input-style-table:hover { border-color: #D1D5DB; background-color: #f9fafb; }
            `}</style>
        </div>
    );
};

export default CrearVenta;