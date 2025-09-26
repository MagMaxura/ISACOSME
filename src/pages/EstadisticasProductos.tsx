import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Table, { Column } from '../components/Table';
import { Producto } from '../types';
import { IconChartBar } from '../components/Icons';
import { fetchProductosConStock } from '../services/productosService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

const EstadisticasProductos: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadProductos = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchProductosConStock();
                setProductos(data);
            } catch (error: any) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };
        loadProductos();
    }, []);

    const columns: Column<Producto>[] = [
        { header: 'Nombre', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Línea', accessor: 'linea' },
        { header: 'Stock Total', accessor: 'stockTotal', render: (item) => (
            <span className={item.stockTotal < 50 ? 'text-red-600 font-bold' : 'text-gray-700'}>{item.stockTotal} u.</span>
        )},
        { header: 'Acciones', accessor: 'id', render: (item) => (
            <Link to={`/productos/${item.id}/dashboard`} className="flex items-center text-sm bg-primary text-white px-3 py-1 rounded-lg shadow hover:bg-primary-dark transition-colors w-fit">
                <IconChartBar className="h-4 w-4 mr-2" />
                Ver Dashboard
            </Link>
        )}
    ];

    const filteredProductos = useMemo(() =>
        productos.filter(producto => 
            producto.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            producto.linea?.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [productos, searchTerm]
    );

    return (
        <div>
            <PageHeader title="Estadísticas de Productos" />
            
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre o línea..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                />
            </div>
            
            <DatabaseErrorDisplay error={error} />
            <Table columns={columns} data={filteredProductos} isLoading={loading} />
        </div>
    );
};

export default EstadisticasProductos;