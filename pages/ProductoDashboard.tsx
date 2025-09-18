

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { fetchProductoDashboardData, DashboardData, InsumoConCosto } from '../services/productoDashboardService';
import { IconArrowLeft, IconPackage } from '../components/Icons';
import BarChart from '../components/BarChart';

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatCard: React.FC<{ title: string; value: string; color: string }> = ({ title, value, color }) => (
    <div className="bg-surface rounded-xl shadow-md p-5">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
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

    const { producto, costoTotal, gananciaNeta, margenGanancia, unidadesVendidas, insumosDetalle, costoInsumos, costoLaboratorioPromedio, ventasPorDia, ventasPorMes, ventasPorAnio } = data;

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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Costo Total / Unidad" value={formatPrice(costoTotal)} color="text-red-600" />
                <StatCard title="Ganancia Neta / Unidad" value={formatPrice(gananciaNeta)} color="text-green-600" />
                <StatCard title="Margen de Ganancia" value={`${margenGanancia.toFixed(2)}%`} color="text-blue-600" />
                <StatCard title="Unidades Vendidas (Total)" value={unidadesVendidas.toLocaleString('es-AR')} color="text-on-surface" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
                <div className="xl:col-span-2">
                    <BarChart data={generateChartData(ventasPorDia)} title="Ventas por Día (Últimos 30 días)" />
                </div>
                <div className="bg-surface rounded-xl shadow-md p-4">
                    <h3 className="text-lg font-bold text-on-surface mb-3">Desglose de Costos por Unidad</h3>
                    <div className="overflow-y-auto max-h-72">
                         <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="py-2 px-3 text-left font-semibold text-gray-600">Componente</th>
                                    <th className="py-2 px-3 text-right font-semibold text-gray-600">Costo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {insumosDetalle.map(insumo => (
                                    <tr key={insumo.id}>
                                        <td className="py-2 px-3">{insumo.nombre}</td>
                                        <td className="py-2 px-3 text-right">{formatPrice(insumo.costo_total_insumo)}</td>
                                    </tr>
                                ))}
                                <tr className="font-semibold bg-gray-50">
                                    <td className="py-2 px-3">Subtotal Insumos</td>
                                    <td className="py-2 px-3 text-right">{formatPrice(costoInsumos)}</td>
                                </tr>
                                <tr className="font-semibold bg-gray-50">
                                    <td className="py-2 px-3">Costo Laboratorio (Promedio)</td>
                                    <td className="py-2 px-3 text-right">{formatPrice(costoLaboratorioPromedio)}</td>
                                </tr>
                                <tr className="font-bold text-base bg-gray-100">
                                    <td className="py-2 px-3">Costo Total</td>
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