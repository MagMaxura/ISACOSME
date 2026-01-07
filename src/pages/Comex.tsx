import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import Table, { Column } from '../components/Table';
import { Producto } from '../types';
import { fetchProductosConStock } from '../services/productosService';
import { fetchCotizaciones, saveCotizaciones } from '../services/ajustesService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import { useAuth } from '../contexts/AuthContext';
import { IconWorld, IconDeviceFloppy, IconCheck } from '../components/Icons';

interface ComexProducto extends Producto {
    precioUSD: number;
    precioBRL: number;
    boxVolumeM3: number;
    weightPerBoxKg: number;
    boxesPerPallet: number;
}

const Comex: React.FC = () => {
    const { profile } = useAuth();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<any | null>(null);
    
    const [usdExchangeRate, setUsdExchangeRate] = useState<number>(1000);
    const [brlExchangeRate, setBrlExchangeRate] = useState<number>(180);

    // FIX: El botón y el panel ahora solo están disponibles para superadmin
    const isSuperAdmin = profile?.roles?.includes('superadmin');

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [productosData, ratesData] = await Promise.all([
                    fetchProductosConStock(),
                    fetchCotizaciones()
                ]);
                setProductos(productosData);
                setUsdExchangeRate(ratesData.usd);
                setBrlExchangeRate(ratesData.brl);
            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const handleSaveRates = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await saveCotizaciones({ usd: usdExchangeRate, brl: brlExchangeRate });
            setSaveSuccess(true);
            // El mensaje de éxito desaparece tras 3 segundos
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setError(err);
        } finally {
            setSaving(false);
        }
    };

    const comexData = useMemo((): ComexProducto[] => {
        return productos.map(p => {
            const hasLogisticsData = p.boxLengthCm && p.boxWidthCm && p.boxHeightCm && p.productWeightKg && p.productsPerBox;

            const precioUSD = (p.precioMayorista || 0) / (usdExchangeRate || 1);
            const precioBRL = (p.precioMayorista || 0) / (brlExchangeRate || 1);
            
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
                precioBRL,
                boxVolumeM3,
                weightPerBoxKg,
                boxesPerPallet,
            };
        });
    }, [productos, usdExchangeRate, brlExchangeRate]);

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


    const formatPrice = (price: number, currency: 'ARS' | 'USD' | 'BRL' = 'ARS') => {
        const locales: Record<string, string> = {
            'ARS': 'es-AR',
            'USD': 'en-US',
            'BRL': 'pt-BR'
        };
        
        return new Intl.NumberFormat(locales[currency], {
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
        { header: 'Precio EXW (BRL)', accessor: 'precioBRL', render: item => <span className="font-bold text-cyan-700">{formatPrice(item.precioBRL, 'BRL')}</span> },
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
                <div className="bg-surface p-6 rounded-xl shadow-md mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 border-l-4 border-primary items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-100 rounded-full text-primary">
                            <IconWorld className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">Panel de Cotizaciones</h4>
                            <p className="text-xs text-gray-500">Define las tasas de cambio para exportación (Solo Administradores).</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="grid grid-cols-2 gap-4 flex-grow w-full">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">USD (en ARS)</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 inset-y-0 flex items-center text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={usdExchangeRate}
                                        onChange={(e) => setUsdExchangeRate(parseFloat(e.target.value) || 1)}
                                        className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none font-semibold"
                                        min="1"
                                        step="0.1"
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">BRL (en ARS)</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 inset-y-0 flex items-center text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={brlExchangeRate}
                                        onChange={(e) => setBrlExchangeRate(parseFloat(e.target.value) || 1)}
                                        className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none font-semibold"
                                        min="1"
                                        step="0.1"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleSaveRates}
                            disabled={saving}
                            className={`flex items-center justify-center px-6 py-2 rounded-lg text-white font-bold transition-all h-[42px] min-w-[140px] w-full sm:w-auto ${saveSuccess ? 'bg-green-500' : 'bg-primary hover:bg-primary-dark shadow-md active:scale-95'}`}
                        >
                            {saving ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : saveSuccess ? (
                                <><IconCheck className="w-5 h-5 mr-2" /> ¡Fijado!</>
                            ) : (
                                <><IconDeviceFloppy className="w-5 h-5 mr-2" /> Fijar Precios</>
                            )}
                        </button>
                    </div>
                </div>
            )}
            
            {loading ? (
                <div className="text-center p-8">Cargando datos de COMEX...</div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedData).map(([linea, productosDeLinea]) => (
                        <div key={linea}>
                             <div className={`p-3 text-white text-center rounded-t-lg shadow-sm ${lineaColors[linea] || 'bg-gray-500'}`}>
                                <h3 className="text-xl font-bold tracking-wider uppercase">{linea}</h3>
                            </div>
                            <Table columns={columns} data={productosDeLinea as ComexProducto[]} isLoading={false} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Comex;