import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import { Producto, Lote, Deposito, TransferenciaStock } from '../types';
import { fetchProductosConStock } from '../services/productosService';
import { fetchDepositos, transferirStock, fetchTransferencias } from '../services/depositosService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import Table, { Column } from '../components/Table';
import { IconSwitchHorizontal } from '../components/Icons';

const TransferenciasStock: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [depositos, setDepositos] = useState<Deposito[]>([]);
    const [transferencias, setTransferencias] = useState<TransferenciaStock[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [selectedProductoId, setSelectedProductoId] = useState<string>('');
    const [selectedLoteId, setSelectedLoteId] = useState<string>('');
    const [selectedDestinoId, setSelectedDestinoId] = useState<string>('');
    const [cantidad, setCantidad] = useState<number>(1);
    
    const selectedProducto = productos.find(p => p.id === selectedProductoId);
    const selectedLote = selectedProducto?.lotes.find(l => l.id === selectedLoteId);
    
    const lotesDisponibles = selectedProducto?.lotes.filter(l => l.cantidad_actual > 0) || [];

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [productosData, depositosData, transferenciasData] = await Promise.all([
                fetchProductosConStock(),
                fetchDepositos(),
                fetchTransferencias()
            ]);
            setProductos(productosData.filter(p => p.stockTotal > 0));
            setDepositos(depositosData);
            setTransferencias(transferenciasData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleProductoChange = (productId: string) => {
        setSelectedProductoId(productId);
        setSelectedLoteId('');
        setSelectedDestinoId('');
        setCantidad(1);
    };

    const handleLoteChange = (loteId: string) => {
        setSelectedLoteId(loteId);
        const lote = lotesDisponibles.find(l => l.id === loteId);
        if(lote) setCantidad(lote.cantidad_actual);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLoteId || !selectedDestinoId || cantidad <= 0) {
            setError("Completa todos los campos para la transferencia.");
            return;
        }
        if (selectedLote && cantidad > selectedLote.cantidad_actual) {
            setError("La cantidad a transferir no puede ser mayor al stock del lote.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await transferirStock(selectedLoteId, selectedDestinoId, cantidad);
            // Reset form and reload data
            setSelectedProductoId('');
            setSelectedLoteId('');
            setSelectedDestinoId('');
            setCantidad(1);
            loadData();
        } catch (err: any) {
            setError(`Error al transferir: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const transferenciasColumns: Column<TransferenciaStock>[] = [
        { header: 'Fecha', accessor: 'fecha' },
        { header: 'Producto', accessor: 'productoNombre' },
        { header: 'Cantidad', accessor: 'cantidad', render: item => `${item.cantidad} u.` },
        { header: 'Origen', accessor: 'depositoOrigenNombre' },
        { header: 'Destino', accessor: 'depositoDestinoNombre' },
        { header: 'Usuario', accessor: 'usuarioEmail' },
    ];

    return (
        <div>
            <PageHeader title="Transferencias de Stock entre Depósitos" />
            <DatabaseErrorDisplay error={error} />

            <div className="bg-surface p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Nueva Transferencia</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Producto</label>
                        <select value={selectedProductoId} onChange={e => handleProductoChange(e.target.value)} required className="mt-1 w-full input-style">
                            <option value="">Seleccionar producto...</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Total: {p.stockTotal}u.)</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Lote de Origen</label>
                        <select value={selectedLoteId} onChange={e => handleLoteChange(e.target.value)} required disabled={!selectedProductoId} className="mt-1 w-full input-style">
                            <option value="">Seleccionar lote...</option>
                            {lotesDisponibles.map(l => <option key={l.id} value={l.id}>{l.numero_lote} ({l.depositoNombre}, Stock: {l.cantidad_actual}u.)</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                        <input type="number" value={cantidad} onChange={e => setCantidad(parseInt(e.target.value, 10))} min="1" max={selectedLote?.cantidad_actual || 1} required disabled={!selectedLoteId} className="mt-1 w-full input-style" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Depósito de Destino</label>
                        <select value={selectedDestinoId} onChange={e => setSelectedDestinoId(e.target.value)} required disabled={!selectedLoteId} className="mt-1 w-full input-style">
                             <option value="">Seleccionar destino...</option>
                             {depositos.filter(d => d.id !== selectedLote?.deposito_id).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                    </div>

                    <div>
                        <button type="submit" disabled={isSubmitting || loading} className="w-full flex justify-center items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300">
                             <IconSwitchHorizontal className="h-5 w-5 mr-2" />
                            {isSubmitting ? 'Transfiriendo...' : 'Transferir'}
                        </button>
                    </div>
                </form>
            </div>

            <div>
                <h3 className="text-xl font-bold text-on-surface mb-4">Historial de Transferencias</h3>
                <Table columns={transferenciasColumns} data={transferencias} isLoading={loading} />
            </div>
             <style>{`.input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; } .input-style:focus { border-color: #8a5cf6; } .input-style:disabled { background-color: #f3f4f6 }`}</style>
        </div>
    );
};

export default TransferenciasStock;