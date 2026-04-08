import React, { useState } from 'react';
import { updateAllPricesByPercentage } from '../services/preciosService';
import { IconTrendingUp, IconAlertTriangle, IconCheck } from './Icons';
import DatabaseErrorDisplay from './DatabaseErrorDisplay';

const InflationManager: React.FC = () => {
    const [percentage, setPercentage] = useState<number>(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<any>(null);
    const [success, setSuccess] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleApply = async () => {
        if (percentage === 0) return;
        
        setIsUpdating(true);
        setError(null);
        setSuccess(false);
        try {
            await updateAllPricesByPercentage(percentage);
            setSuccess(true);
            setPercentage(0);
            setShowConfirm(false);
            // Hide success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <IconTrendingUp className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Ajuste por Inflación</h3>
                        <p className="text-sm text-gray-500">Aumentar todos los precios de venta masivamente</p>
                    </div>
                </div>

                <DatabaseErrorDisplay error={error} />

                {success && (
                    <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 flex items-center gap-3">
                        <IconCheck className="h-5 w-5 text-green-600" />
                        <p className="text-green-700 font-medium">¡Precios actualizados con éxito!</p>
                    </div>
                )}

                {!showConfirm ? (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="percentage" className="block text-sm font-medium text-gray-700 mb-1">
                                Porcentaje de Incremento (%)
                            </label>
                            <div className="flex gap-4">
                                <input
                                    type="number"
                                    id="percentage"
                                    value={percentage === 0 ? '' : percentage}
                                    onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                                    placeholder="Ej: 2.4"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    min="0"
                                    step="0.1"
                                />
                                <button
                                    onClick={() => percentage > 0 && setShowConfirm(true)}
                                    disabled={percentage <= 0}
                                    className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Aplicar Aumento
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            * Esto afectará a TODOS los productos y listas de precios personalizadas.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-start gap-3 mb-4">
                            <IconAlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="text-red-800 font-bold">¿Estás seguro?</p>
                                <p className="text-red-700 text-sm">
                                    Esta acción incrementará los precios de <strong>todos los productos</strong> en un <strong>{percentage}%</strong>. 
                                    Esta operación no se puede deshacer fácilmente.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={isUpdating}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={isUpdating}
                                className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:bg-red-300"
                            >
                                {isUpdating ? 'Actualizando...' : 'Sí, confirmar aumento'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InflationManager;
