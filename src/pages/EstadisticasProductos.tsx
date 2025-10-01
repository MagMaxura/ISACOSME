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
    
    const columns: Column<ProductoEstadistica>[] = [
        { header: 'Producto', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Ventas (Mes)', accessor: 'ventasMesActual', render: (item) => `${item.ventasMesActual} u.` },
        { header: 'Ventas (Total)', accessor: 'ventasTotales', render: (item) => `${item.ventasTotales} u.` },
        { header: 'Costo Unitario', accessor: 'costoTotalUnitario', render: (item) => formatPrice(item.costoTotalUnitario) },
        { header: 'Ganancia Unitaria (Público)', accessor: 'gananciaUnitariaPublico', render: (item) => <span className="font-semibold text-green-700">{formatPrice(item.gananciaUnitariaPublico)}</span> },
        { header: 'Ganancia Unitaria (Comercio)', accessor: 'gananciaUnitariaComercio', render: (item) => <span className="font-semibold text-green-600">{formatPrice(item.gananciaUnitariaComercio)}</span> },
        { header: 'Ganancia Unitaria (Mayorista)', accessor: 'gananciaUnitariaMayorista', render: (item) => <span className="font-semibold text-green-500">{formatPrice(item.gananciaUnitariaMayorista)}</span> },
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
                Nota: Las ganancias unitarias son teóricas y se calculan como la diferencia entre el precio de lista de cada categoría y el costo unitario total. El costo unitario se basa en el costo de insumos más el costo de laboratorio del último lote producido.
            </p>
        </div>
    );
};

export default EstadisticasProductos;