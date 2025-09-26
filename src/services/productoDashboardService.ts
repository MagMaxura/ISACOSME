import { supabase } from '../supabase';
// FIX: Import DashboardData from the shared types file to ensure consistency.
import { Producto, StockPorDeposito, DashboardData, InsumoConCosto } from '../types';
import { fetchProductosConStock } from './productosService';

const SERVICE_NAME = 'ProductoDashboardService';

export const fetchProductoDashboardData = async (productoId: string): Promise<DashboardData> => {
    console.log(`[${SERVICE_NAME}] Fetching all dashboard data for product ID: ${productoId}`);
    try {
        // 1. Fetch the complete product object using the robust, existing service
        const allProducts = await fetchProductosConStock();
        const productoData = allProducts.find(p => p.id === productoId);

        if (!productoData) {
            throw new Error(`Producto con ID '${productoId}' no encontrado.`);
        }
        
        // 2. Fetch all sales items for this product
        const { data: salesData, error: salesError } = await (supabase
            .from('venta_items') as any)
            .select(`cantidad, precio_unitario, ventas!inner(fecha)`)
            .eq('producto_id', productoId);

        if (salesError) {
            (salesError as any)._tableName = 'venta_items/ventas';
            throw salesError;
        }

        // 3. Fetch detailed insumos for cost calculation
        const { data: insumosData, error: insumosError } = await supabase
            .from('productos_insumos')
            .select('cantidad, insumos(*)')
            .eq('producto_id', productoId);
        
        if (insumosError) throw insumosError;

        // --- Process Costs & Profitability (The Root Fix) ---
        const insumosDetalle: InsumoConCosto[] = (insumosData || [])
            .filter((pi: any) => pi.insumos)
            .map((pi: any) => ({
                id: pi.insumos.id,
                nombre: pi.insumos.nombre,
                cantidad_necesaria: pi.cantidad,
                costo_total_insumo: pi.cantidad * (pi.insumos.costo || 0),
                unidad: pi.insumos.unidad,
            }));
        
        // Recalculate insumo cost from current insumo prices for maximum accuracy
        const costoInsumos = insumosDetalle.reduce((sum, item) => sum + item.costo_total_insumo, 0);

        // Sort lots by creation date to find the most recent one
        // The lots are already on productoData from fetchProductosConStock, which gets them from the DB
        const lotes = (productoData.lotes || []).sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // CRITICAL FIX: Get the lab cost from ONLY the most recent lot, and treat it as a per-unit cost (no division).
        const costoLaboratorioReciente = lotes.length > 0 ? lotes[0].costo_laboratorio || 0 : 0;

        const costoTotal = costoInsumos + costoLaboratorioReciente;
        const gananciaNeta = productoData.precioPublico - costoTotal;
        const margenGanancia = productoData.precioPublico > 0 ? (gananciaNeta / productoData.precioPublico) * 100 : 0;

        // --- Process Sales Data & New Stats ---
        const unidadesVendidas = salesData.reduce((sum, item) => sum + item.cantidad, 0);
        const totalIngresosProducto = salesData.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
        const precioPromedioVenta = unidadesVendidas > 0 ? totalIngresosProducto / unidadesVendidas : 0;
        
        const sortedSales = salesData.sort((a, b) => new Date(b.ventas.fecha).getTime() - new Date(a.ventas.fecha).getTime());
        const ultimaVentaFecha = sortedSales.length > 0 ? new Date(sortedSales[0].ventas.fecha).toLocaleDateString('es-AR') : null;

        const ventasPorDia: { [date: string]: number } = {};
        const ventasPorMes: { [month: string]: number } = {};
        const ventasPorAnio: { [year: string]: number } = {};

        const today = new Date();
        const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
        const twelveMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 12));

        salesData.forEach(sale => {
            const saleDate = new Date(sale.ventas.fecha);
            
            const year = saleDate.getFullYear().toString();
            ventasPorAnio[year] = (ventasPorAnio[year] || 0) + sale.cantidad;

            if (saleDate >= twelveMonthsAgo) {
                const month = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
                ventasPorMes[month] = (ventasPorMes[month] || 0) + sale.cantidad;
            }

            if (saleDate >= thirtyDaysAgo) {
                const day = saleDate.toISOString().split('T')[0];
                ventasPorDia[day] = (ventasPorDia[day] || 0) + sale.cantidad;
            }
        });

        console.log(`[${SERVICE_NAME}] Successfully processed dashboard data for '${productoData.nombre}'.`);
        return {
            producto: productoData,
            costoInsumos,
            costoLaboratorioReciente,
            costoTotal,
            gananciaNeta,
            margenGanancia,
            unidadesVendidas,
            totalIngresosProducto,
            stockTotalActual: productoData.stockTotal,
            ultimaVentaFecha,
            precioPromedioVenta,
            insumosDetalle,
            stockPorDeposito: productoData.stockPorDeposito,
            ventasPorDia,
            ventasPorMes,
            ventasPorAnio,
        };

    } catch (error: any) {
        const tableName = error._tableName ? ` en la(s) tabla(s) '${error._tableName}'` : '';
        console.error(`[${SERVICE_NAME}] Error fetching dashboard data${tableName}:`, error);
        if (error.message.includes('security policy') || error.message.includes('does not exist')) {
            throw new Error(`Error de permisos (RLS)${tableName}. Por favor, revisa las políticas de seguridad en la base de datos.`);
        }
        throw new Error(`No se pudo cargar el dashboard del producto: ${error.message}`);
    }
};
