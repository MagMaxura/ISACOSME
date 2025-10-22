import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import Table, { Column } from '../components/Table';
import { ProductoEstadistica } from '../types';
import { fetchProductStatistics } from '../services/estadisticasService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const EstadisticasProductos: React.FC = () => {
    const [stats, setStats] = useState<ProductoEstadistica[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchProductStatistics();
                setStats(data);
            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);
    
    const ProfitCell: React.FC<{ profit: number; cost: number }> = ({ profit, cost }) => {
        const percentage = cost > 0 ? (profit / cost) * 100 : 0;
        const colorClass = profit >= 0 ? 'text-green-600' : 'text-red-600';

        return (
            <span className={`font-semibold ${colorClass}`}>
                {formatPrice(profit)} ({percentage.toFixed(1)}%)
            </span>
        );
    };

    const columns: Column<ProductoEstadistica>[] = [
        { header: 'Producto', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Ventas (Mes)', accessor: 'ventasMesActual', render: (item) => `${item.ventasMesActual} u.` },
        { header: 'Ventas (Total)', accessor: 'ventasTotales', render: (item) => `${item.ventasTotales} u.` },
        { header: 'Costo Unitario', accessor: 'costoTotalUnitario', render: (item) => formatPrice(item.costoTotalUnitario) },
        { header: 'Ganancia Unitaria (Público)', accessor: 'gananciaUnitariaPublico', render: (item) => <ProfitCell profit={item.gananciaUnitariaPublico} cost={item.costoTotalUnitario} /> },
        { header: 'Ganancia Unitaria (Comercio)', accessor: 'gananciaUnitariaComercio', render: (item) => <ProfitCell profit={item.gananciaUnitariaComercio} cost={item.costoTotalUnitario} /> },
        { header: 'Ganancia Unitaria (Mayorista)', accessor: 'gananciaUnitariaMayorista', render: (item) => <ProfitCell profit={item.gananciaUnitariaMayorista} cost={item.costoTotalUnitario} /> },
    ];

    const filteredStats = useMemo(() =>
        stats.filter(stat => 
            stat.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [stats, searchTerm]
    );

    return (
        <div>
            <PageHeader title="Estadísticas de Rentabilidad por Producto" />
            
             <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre de producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                />
            </div>

            <DatabaseErrorDisplay error={error} />

            <Table columns={columns} data={filteredStats} isLoading={loading} />
            
            <p className="text-xs text-gray-500 mt-4">
                Nota: La ganancia unitaria es la diferencia entre el precio de lista y el costo unitario total. El costo unitario se basa en el costo de insumos más el costo de laboratorio del último lote producido. El porcentaje de ganancia se calcula sobre el costo.
            </p>
        </div>
    );
};

export default EstadisticasProductos;