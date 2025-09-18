
import React, { useState, useEffect } from 'react';
import { Insumo } from '../types';
import { IconX } from './Icons';
import { addStockToInsumo } from '../services/insumosService';

interface StockUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  insumo: Insumo | null;
}

const StockUpdateModal: React.FC<StockUpdateModalProps> = ({ isOpen, onClose, onSuccess, insumo }) => {
    const [cantidad, setCantidad] = useState(0);
    const [costo, setCosto] = useState(insumo?.costo || 0);
    const [lote, setLote] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (insumo) {
            setCosto(insumo.costo);
            setLote(insumo.ultimo_lote_pedido || '');
            setFecha(new Date().toISOString().split('T')[0]);
            setCantidad(0);
        }
    }, [insumo]);
    
    const resetAndClose = () => {
        setError(null);
        setIsSubmitting(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!insumo || cantidad <= 0) {
            setError('La cantidad a agregar debe ser mayor a cero.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await addStockToInsumo({
                insumoId: insumo.id,
                cantidad,
                costo,
                lote,
                fecha,
            });
            onSuccess();
        } catch (err: any) {
            setError(`Error al actualizar el stock: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !insumo) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">
                        Registrar Compra: <span className="text-primary">{insumo.nombre}</span>
                    </h3>
                    <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
                    
                    <div>
                        <p className="text-sm text-gray-600">Stock actual: <span className="font-bold">{insumo.stock} {insumo.unidad}</span></p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cantidad" className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Agregar</label>
                            <input
                                type="number"
                                name="cantidad"
                                id="cantidad"
                                value={cantidad}
                                onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
                                required
                                min="0.01"
                                step="any"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="costo" className="block text-sm font-medium text-gray-700 mb-1">Nuevo Costo Unit. (ARS)</label>
                            <input
                                type="number"
                                name="costo"
                                id="costo"
                                value={costo}
                                onChange={(e) => setCosto(parseFloat(e.target.value) || 0)}
                                required
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="lote" className="block text-sm font-medium text-gray-700 mb-1">Lote de Compra</label>
                            <input
                                type="text"
                                name="lote"
                                id="lote"
                                value={lote}
                                onChange={(e) => setLote(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                            <input
                                type="date"
                                name="fecha"
                                id="fecha"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-6">
                        <button type="button" onClick={resetAndClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-2 hover:bg-gray-300 transition-colors">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors disabled:bg-violet-300 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Guardando...' : 'Agregar Stock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockUpdateModal;