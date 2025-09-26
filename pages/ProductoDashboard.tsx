import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { fetchProductoDashboardData } from '../services/productoDashboardService';
import type { DashboardData } from '../types';
// FIX: Replace non-existent IconCash with IconCashBanknote and add IconScale which is now available.
import { IconArrowLeft, IconCashBanknote, IconPackage, IconClock, IconScale } from '../components/Icons';
import BarChart from '../components/BarChart';

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-surface rounded-xl shadow-md p-5 flex items-start">
         <div className={`p-3 rounded-full mr-4 ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className={`text-2xl font-bold text-on-surface`}>{value}</p>
        </div>
    </div>
);

const ProductoDashboard: React.FC = () => {
    const { productoId } = useParams<{ productoId: string }>();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!productoId) {
            setError("No se especificó un ID de producto.");
            setLoading(false);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const dashboardData = await fetchProductoDashboardData(productoId);
                setData(dashboardData);
            } catch (err: any) {
                setError(`No se pudieron cargar los datos del dashboard: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [productoId]);

    if (loading) {
        return <div className="text-center p-8">Cargando dashboard del producto...</div>;
    }

    if (error) {
        return (
             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        );
    }
    
    if (!data) {
        return <div className="text-center p-8">No se encontraron datos para este producto.</div>;
    }

    // FIX: Destructure the complete, up-to-date DashboardData object, using `costoLaboratorioReciente`
    const { 
        producto, costoTotal, gananciaNeta, margenGanancia, unidadesVendidas, insumosDetalle, 
        costoInsumos, costoLaboratorioReciente, ventasPorDia, ventasPorMes, ventasPorAnio,
        totalIngresosProducto, stockTotalActual, ultimaVentaFecha, precioPromedioVenta, stockPorDeposito
    } = data;

    const generateChartData = (salesData: { [key: string]: number }) => {
        const sortedLabels = Object.keys(salesData).sort();
        return {
            labels: sortedLabels,
            datasets: [
                {
                    label: 'Unidades Vendidas',
                    data: sortedLabels.map(label => salesData[label]),
                    backgroundColor: 'rgba(138, 92, 246, 0.6)',
                    borderColor: 'rgba(138, 92, 246, 1)',
                    borderWidth: 1,
                },
            ],
        };
    };

    return (
        <div>
            <PageHeader title={producto.nombre}>
                 <Link to="/productos" className="flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-300 transition-colors">
                    <IconArrowLeft className="h-5 w-5 mr-2" />
                    Volver a Productos
                </Link>
            </PageHeader>
            
             {/* Main KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Ingresos Totales" value={formatPrice(totalIngresosProducto)} icon={<IconCashBanknote className="h-6 w-6 text-white" />} color="bg-green-500" />
                <StatCard title="Stock Total Actual" value={`${stockTotalActual.toLocaleString('es-AR')} u.`} icon={<IconPackage className="h-6 w-6 text-white" />} color="bg-blue-500" />
                <StatCard title="Última Venta" value={ultimaVentaFecha || 'N/A'} icon={<IconClock className="h-6 w-6 text-white" />} color="bg-violet-500" />
                <StatCard title="Precio Prom. Venta" value={formatPrice(precioPromedioVenta)} icon={<IconScale className="h-6 w-6 text-white" />} color="bg-pink-500" />
            </div>

            {/* Profitability & Inventory */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 mb-8">
                <div className="xl:col-span-2 space-y-6">
                    {/* Profitability */}
                    <div className="bg-surface rounded-xl shadow-md p-4">
                        <h3 className="text-lg font-bold text-on-surface mb-3">Rentabilidad por Unidad</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center"><span className="text-gray-600">Costo Total:</span> <span className="font-bold text-red-600">{formatPrice(costoTotal)}</span></div>
                            <div className="flex justify-between items-center"><span className="text-gray-600">Ganancia Neta:</span> <span className="font-bold text-green-600">{formatPrice(gananciaNeta)}</span></div>
                            <div className="flex justify-between items-center"><span className="text-gray-600">Margen de Ganancia:</span> <span className="font-bold text-blue-600">{margenGanancia.toFixed(2)}%</span></div>
                        </div>
                    </div>
                    {/* Inventory */}
                    <div className="bg-surface rounded-xl shadow-md p-4">
                        <h3 className="text-lg font-bold text-on-surface mb-3">Inventario Actual por Depósito</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                            {stockPorDeposito.length > 0 ? stockPorDeposito.map(deposito => (
                                <div key={deposito.depositoId}>
                                    <div className="flex justify-between items-center text-sm mb-1">
                                        <span className="font-semibold text-gray-700">{deposito.depositoNombre}</span>
                                        <span className="font-bold">{deposito.stock} / {stockTotalActual} u.</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${stockTotalActual > 0 ? (deposito.stock / stockTotalActual) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center">Sin stock registrado.</p>}
                        </div>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div className="xl:col-span-3 bg-surface rounded-xl shadow-md p-4">
                    <h3 className="text-lg font-bold text-on-surface mb-3">Desglose de Costos por Unidad</h3>
                    <div className="overflow-y-auto max-h-96">
                         <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="py-2 px-3 text-left font-semibold text-gray-600">Componente</th>
                                    <th className="py-2 px-3 text-center font-semibold text-gray-600">Cant. Necesaria</th>
                                    <th className="py-2 px-3 text-right font-semibold text-gray-600">Costo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {insumosDetalle.map(insumo => (
                                    <tr key={insumo.id}>
                                        <td className="py-2 px-3">{insumo.nombre}</td>
                                        <td className="py-2 px-3 text-center">{insumo.cantidad_necesaria} {insumo.unidad}</td>
                                        <td className="py-2 px-3 text-right">{formatPrice(insumo.costo_total_insumo)}</td>
                                    </tr>
                                ))}
                                <tr className="font-semibold bg-gray-50">
                                    <td className="py-2 px-3" colSpan={2}>Subtotal Insumos</td>
                                    <td className="py-2 px-3 text-right">{formatPrice(costoInsumos)}</td>
                                </tr>
                                <tr className="font-semibold bg-gray-50">
                                    {/* FIX: Use correct variable and a more accurate label. */}
                                    <td className="py-2 px-3" colSpan={2}>Costo Laboratorio (por Unidad)</td>
                                    <td className="py-2 px-3 text-right">{formatPrice(costoLaboratorioReciente)}</td>
                                </tr>
                                <tr className="font-bold text-base bg-gray-100">
                                    <td className="py-2 px-3" colSpan={2}>Costo Total</td>
                                    <td className="py-2 px-3 text-right">{formatPrice(costoTotal)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <BarChart data={generateChartData(ventasPorMes)} title="Ventas por Mes (Últimos 12 meses)" />
                <BarChart data={generateChartData(ventasPorAnio)} title="Ventas por Año" />
            </div>
        </div>
    );
};

export default ProductoDashboard;
