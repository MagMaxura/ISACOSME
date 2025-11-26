import { supabase } from '../supabase';
import { ProductoEstadistica } from '../types';

const SERVICE_NAME = 'EstadisticasService';

export const fetchProductStatistics = async (): Promise<ProductoEstadistica[]> => {
    console.log(`[${SERVICE_NAME}] Fetching data for client-side statistics calculation.`);
    try {
        // 1. Fetch all necessary raw data in parallel
        const [
            { data: productos, error: productosError },
            { data: ventaItems, error: ventaItemsError },
            { data: lotes, error: lotesError },
            { data: insumos, error: insumosError },
            { data: productosInsumos, error: productosInsumosError },
        ] = await Promise.all([
            supabase.from('productos').select('id, nombre, precio_publico, precio_comercio, precio_mayorista'),
            supabase.from('venta_items').select('producto_id, cantidad, ventas!inner(fecha)'),
            supabase.from('lotes').select('producto_id, cantidad_actual, costo_laboratorio, created_at'),
            supabase.from('insumos').select('id, costo'),
            supabase.from('productos_insumos').select('producto_id, insumo_id, cantidad')
        ]);

        // Error handling for each fetch
        if (productosError) throw productosError;
        if (ventaItemsError) throw ventaItemsError;
        if (lotesError) throw lotesError;
        if (insumosError) throw insumosError;
        if (productosInsumosError) throw productosInsumosError;

        // --- Data Preparation ---
        // Create maps for efficient lookups
        const insumosCostMap = new Map(insumos.map(i => [i.id, i.costo]));

        const productInsumosMap = new Map<string, { insumo_id: string; cantidad: number }[]>();
        for (const pi of productosInsumos) {
            if (!productInsumosMap.has(pi.producto_id)) {
                productInsumosMap.set(pi.producto_id, []);
            }
            productInsumosMap.get(pi.producto_id)!.push({ insumo_id: pi.insumo_id, cantidad: pi.cantidad });
        }

        const stats: ProductoEstadistica[] = productos.map(p => {
            // --- Sales Calculations ---
            const productSales = ventaItems.filter(vi => vi.producto_id === p.id);
            let ventasMesActual = 0;
            let ventasAñoActual = 0;
            let last90DaysSold = 0;
            let last12MonthsSold = 0;

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const ninetyDaysAgo = new Date(new Date().setDate(now.getDate() - 90));
            const twelveMonthsAgo = new Date(new Date().setFullYear(now.getFullYear() - 1));

            for (const sale of productSales) {
                // Supabase returns date strings in ISO 8601 format
                const saleDate = new Date((sale.ventas as any).fecha);
                if (saleDate >= startOfMonth) ventasMesActual += sale.cantidad;
                if (saleDate >= startOfYear) ventasAñoActual += sale.cantidad;
                if (saleDate >= ninetyDaysAgo) last90DaysSold += sale.cantidad;
                if (saleDate >= twelveMonthsAgo) last12MonthsSold += sale.cantidad;
            }

            // --- Cost Calculation ---
            const relatedInsumos = productInsumosMap.get(p.id) || [];
            const insumosCost = relatedInsumos.reduce((acc, current) => {
                const cost = Number(insumosCostMap.get(current.insumo_id)) || 0;
                return acc + (cost * (Number(current.cantidad) || 0));
            }, 0);

            const productLotes = lotes
                .filter(l => l.producto_id === p.id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            const costoLaboratorioReciente = productLotes.length > 0 ? (Number(productLotes[0].costo_laboratorio) || 0) : 0;
            const costoTotalUnitario = insumosCost + costoLaboratorioReciente;

            // --- Stock Calculation ---
            // FIX: Ensure 'lote.cantidad_actual' is treated as a number to prevent TS2532 and runtime errors by explicitly casting it with Number() or providing a fallback.
            const stockTotal = productLotes.reduce((acc, lote) => acc + (Number(lote.cantidad_actual) || 0), 0);

            // --- Advanced Stats ---
            const tasaRotacion = stockTotal > 0 ? (last12MonthsSold / stockTotal) : 0;
            const tasaVentasPromedio = last90DaysSold / 3.0;

            return {
                id: p.id,
                nombre: p.nombre,
                ventasMesActual: ventasMesActual,
                ventasAñoActual: ventasAñoActual,
                costoTotalUnitario: costoTotalUnitario,
                precioPublico: p.precio_publico,
                precioComercio: p.precio_comercio,
                precioMayorista: p.precio_mayorista,
                stockTotal: stockTotal,
                tasaRotacion: tasaRotacion,
                tasaVentasPromedio: tasaVentasPromedio,
            };
        });
        
        console.log(`[${SERVICE_NAME}] Successfully calculated statistics for ${stats.length} products on the client-side.`);
        return stats.sort((a,b) => a.nombre.localeCompare(b.nombre));

    } catch (error: any) {
        console.error(`[${SERVICE_NAME}] Error calculating product statistics on client-side:`, error);
        // Provide a generic but useful error, since the RPC one is no longer relevant.
        throw new Error(`No se pudieron cargar los datos para las estadísticas. Error: ${error.message}`);
    }
};