import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { IconShoppingCart, IconPackage, IconUsers, IconBuildingWarehouse } from '../components/Icons';
import { LowStockInsumo, LowStockProducto, MonthlyData } from '../types';
import Table, { Column } from '../components/Table';
import BarChart from '../components/BarChart';
import { ChartData } from 'chart.js';
import { Link } from 'react-router-dom';
import { fetchDashboardData } from '../services/dashboardService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';
import { useAuth } from '../contexts/AuthContext';
import InflationManager from '../components/InflationManager';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProductStock, setTotalProductStock] = useState(0);
  const [totalInsumosCount, setTotalInsumosCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProducto[]>([]);
  const [lowStockInsumos, setLowStockInsumos] = useState<LowStockInsumo[]>([]);
  const [salesByMonth, setSalesByMonth] = useState<MonthlyData[]>([]);
  const [unitsByMonth, setUnitsByMonth] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      console.log("[DashboardPage] Mounting and fetching data.");
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardData();
        setTotalSales(data.totalSales);
        setTotalRevenue(data.totalRevenue);
        setTotalProductStock(data.totalProductStock);
        setTotalInsumosCount(data.totalInsumosCount);
        setLowStockProducts(data.lowStockProducts);
        setLowStockInsumos(data.lowStockInsumos);
        setSalesByMonth(data.salesByMonth || []);
        setUnitsByMonth(data.unitsByMonth || []);
        console.log("[DashboardPage] Data fetched successfully.", data);
      } catch (err: any) {
        console.error("[DashboardPage] Failed to fetch data.", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
        console.log("[DashboardPage] Fetch process finished.");
      }
    };

    loadData();
  }, []);
  
  const lowStockProductsColumns: Column<LowStockProducto>[] = [
    { header: 'Producto', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
    { header: 'Stock Actual', accessor: 'stock', render: (item) => <span className="font-bold text-red-600">{item.stock} u.</span> },
  ];

  const lowStockInsumosColumns: Column<LowStockInsumo>[] = [
    { header: 'Insumo', accessor: 'nombre', render: (item) => <span className="font-semibold">{item.nombre}</span> },
    { header: 'Stock Actual', accessor: 'stock', render: (item) => <span className="font-bold text-yellow-600">{item.stock} {item.unidad}</span> },
  ];
  
  const isSuperAdmin = profile?.roles?.includes('superadmin');
  
  const cardContainerClass = isSuperAdmin
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8';

  return (
    <div>
      <PageHeader title="Dashboard" />

      <DatabaseErrorDisplay error={error} />
      
      <div className={cardContainerClass}>
        {isSuperAdmin && (
            <Card 
              title="Ingresos (Año Actual)" 
              value={loading ? '...' : `$${totalRevenue.toLocaleString('es-AR')}`} 
              icon={<IconShoppingCart className="h-6 w-6 text-white" />}
              color="bg-violet-500"
            />
        )}
        <Card 
          title="Total de Ventas" 
          value={loading ? '...' : totalSales.toString()} 
          icon={<IconUsers className="h-6 w-6 text-white" />}
          color="bg-pink-500"
        />
        <Card 
          title="Stock de Productos (U.)" 
          value={loading ? '...' : totalProductStock.toLocaleString('es-AR')}
          icon={<IconPackage className="h-6 w-6 text-white" />}
          color="bg-blue-500"
        />
        <Card 
          title="Tipos de Insumos" 
          value={loading ? '...' : totalInsumosCount.toString()} 
          icon={<IconBuildingWarehouse className="h-6 w-6 text-white" />}
          color="bg-green-500"
        />
      </div>

      {isSuperAdmin && (
        <div className="mb-10 max-w-2xl">
          <InflationManager />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BarChart 
          title="Ventas Mensuales ($)" 
          data={{
            labels: salesByMonth.map(d => d.month),
            datasets: [{
              label: 'Monto Total',
              data: salesByMonth.map(d => d.value),
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: 'rgb(139, 92, 246)',
              borderWidth: 1,
            }]
          }} 
        />
        <BarChart 
          title="Unidades Vendidas por Mes" 
          data={{
            labels: unitsByMonth.map(d => d.month),
            datasets: [{
              label: 'Cantidad Unidades',
              data: unitsByMonth.map(d => d.value),
              backgroundColor: 'rgba(236, 72, 153, 0.6)',
              borderColor: 'rgb(236, 72, 153)',
              borderWidth: 1,
            }]
          }} 
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-on-surface">Productos con Bajo Stock</h3>
                <Link to="/stock/productos" className="text-sm font-medium text-primary hover:underline">Gestionar Stock</Link>
            </div>
            <Table columns={lowStockProductsColumns} data={lowStockProducts} isLoading={loading} />
        </div>
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-on-surface">Insumos con Bajo Stock</h3>
                <Link to="/stock/insumos" className="text-sm font-medium text-primary hover:underline">Gestionar Insumos</Link>
            </div>
            <Table columns={lowStockInsumosColumns} data={lowStockInsumos} isLoading={loading} />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;