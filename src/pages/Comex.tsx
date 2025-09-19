import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Table, { Column } from '@/components/Table';
import { Producto } from '@/types';
import { fetchProductosConStock } from '@/services/productosService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { IconWorld } from '@/components/Icons';

interface ComexProducto extends Producto {
    precioUSD: number;
    boxVolumeM3: number;
    weightPerBoxKg: number;
    boxesPerPallet: number;
}

const Comex: React.FC = () => {
    const { profile } = useAuth();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usdExchangeRate, setUsdExchangeRate] = useState<number>(1000);

    const isSuperAdmin = profile?.roles?.includes('superadmin');

    useEffect(() => {
        const loadProductos = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchProductosConStock();
                setProductos(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadProductos();
    }, []);

    const comexData = useMemo((): ComexProducto[] => {
        return productos.map(p => {
            const hasLogisticsData = p.boxLengthCm && p.boxWidthCm && p.boxHeightCm && p.productWeightKg && p.productsPerBox;

            const precioUSD = (p.precioMayorista || 0) / usdExchangeRate;
            
            const boxVolumeM3 = hasLogisticsData
                ? (p.boxLengthCm! * p.boxWidthCm! * p.boxHeightCm!) / 1_000_000
                : 0;

            const weightPerBoxKg = hasLogisticsData
                ? p.productWeightKg! * p.productsPerBox!
                : 0;
            
            const boxesPerPallet = hasLogisticsData && p.boxLengthCm! > 0 && p.boxWidthCm! > 0
                ? Math.floor((100 * 100) / (p.boxLengthCm! * p.boxWidthCm!))
                : 0;

            return {
                ...p,
                precioUSD,
                boxVolumeM3,
                weightPerBoxKg,
                boxesPerPallet,
            };
        });
    }, [productos, usdExchangeRate]);

    const groupedData = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        
        const grouped = comexData.reduce((acc, producto) => {
            const linea = producto.linea || 'General';
            if (!acc[linea]) {
                acc[linea] = [];
            }
            acc[linea].push(producto);
            return acc;
        }, {} as Record<string, ComexProducto[]>);

        const sortedGroup: Record<string, ComexProducto[]> = {};
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
    }, [comexData]);


    const formatPrice = (price: number, currency: 'ARS' | 'USD' = 'ARS') => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    };

    const columns: Column<ComexProducto>[] = [
        { header: 'Producto', accessor: 'nombre', render: item => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Precio Mayorista', accessor: 'precioMayorista', render: item => formatPrice(item.precioMayorista) },
        { header: 'Precio EXW (USD)', accessor: 'precioUSD', render: item => <span className="font-bold text-green-700">{formatPrice(item.precioUSD, 'USD')}</span> },
        { header: 'Dimensiones Caja (cm)', accessor: 'boxLengthCm', render: item => item.boxLengthCm ? `${item.boxLengthCm}x${item.boxWidthCm}x${item.boxHeightCm}` : 'N/A'},
        { header: 'Volumen Caja (m³)', accessor: 'boxVolumeM3', render: item => item.boxVolumeM3 > 0 ? item.boxVolumeM3.toFixed(4) : 'N/A' },
        { header: 'Peso por Caja (kg)', accessor: 'weightPerBoxKg', render: item => item.weightPerBoxKg > 0 ? `${item.weightPerBoxKg.toFixed(2)} kg` : 'N/A' },
        { header: 'Cajas por Pallet', accessor: 'boxesPerPallet', render: item => item.boxesPerPallet > 0 ? item.boxesPerPallet : 'N/A' },
    ];

    const lineaColors: Record<string, string> = {
        'ULTRAHISNE': 'bg-orange-500',
        'BODYTAN CARIBEAN': 'bg-yellow-800',
        'SECRET': 'bg-gray-800',
        'ESSENS': 'bg-blue-300',
        'General': 'bg-gray-500',
    };

    return (
        <div>
            <PageHeader title="COMEX - Cotización Internacional" />
            <DatabaseErrorDisplay error={error} />
            
            {isSuperAdmin && (
                <div className="bg-surface p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row items-center gap-4">
                    <IconWorld className="h-8 w-8 text-primary" />
                    <div>
                        <label htmlFor="usdRate" className="font-semibold text-gray-700">Cotización Dólar (ARS a USD)</label>
                        <p className="text-xs text-gray-500">Ingrese el valor de 1 USD en ARS para calcular los precios EXW.</p>
                    </div>
                    <div className="relative ml-auto">
                        <span className="absolute left-3 inset-y-0 flex items-center text-gray-500">$</span>
                        <input
                            type="number"
                            id="usdRate"
                            value={usdExchangeRate}
                            onChange={(e) => setUsdExchangeRate(parseFloat(e.target.value) || 1)}
                            className="w-48 pl-7 pr-2 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                            min="1"
                            step="0.01"
                        />
                    </div>
                </div>
            )}
            
            {loading ? (
                <div className="text-center p-8">Cargando datos de COMEX...</div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedData).map(([linea, productosDeLinea]) => (
                        <div key={linea}>
                             <div className={`p-3 text-white text-center rounded-t-lg ${lineaColors[linea] || 'bg-gray-500'}`}>
                                <h3 className="text-xl font-bold tracking-wider uppercase">{linea}</h3>
                            </div>
                            {/* Cast 'productosDeLinea' to 'ComexProducto[]' because Object.entries widens the value type, causing a mismatch with the Table's expected 'data' prop type. */}
                            <Table columns={columns} data={productosDeLinea as ComexProducto[]} isLoading={false} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Comex;