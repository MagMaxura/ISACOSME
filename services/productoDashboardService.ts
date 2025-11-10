import { supabase } from '../supabase';
import { Producto, StockPorDeposito } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

const SERVICE_NAME = 'ProductoDashboardService';

export interface InsumoConCosto {
    id: string;
    nombre: string;
    cantidad_necesaria: number;
    costo_total_insumo: number;
}

// FIX: Removed outdated local DashboardData interface to rely on the one from types.ts
// export interface DashboardData { ... }

export const fetchProductoDashboardData = async (productoId: string): Promise<any> => {
    console.log(`[${SERVICE_NAME}] Fetching all dashboard data for product ID: ${productoId}`);
    try {
        const productRes = await (supabase
            .from('productos') as any)
            .select(`
                *,
                productos_insumos (cantidad, insumos (*)),
                lotes (cantidad_inicial, costo_laboratorio)
            `)
            .eq('id', productoId)
            .single();

        if (productRes.error) {
            (productRes.error as any)._tableName = 'productos/lotes/insumos';
            throw productRes.error;
        }
        if (!productRes.data) {
            throw new Error(`Producto con ID '${productoId}' no encontrado.`);
        }

        const salesRes = await (supabase
            .from('venta_items') as any)
            .select(`cantidad, ventas!inner(fecha)`)
            .eq('producto_id', productoId);

        if (salesRes.error) {
            (salesRes.error as any)._tableName = 'venta_items/ventas';
            throw salesRes.error;
        }
        
        const productoData = productRes.data as any;
        const salesData = salesRes.data as any[];

        // --- Process Costs & Profitability ---
        const insumosDetalle: InsumoConCosto[] = (productoData.productos_insumos || [])
            .filter((pi: any) => pi.insumos)
            .map((pi: any) => ({
                id: pi.insumos.id,
                nombre: pi.insumos.nombre,
                cantidad_necesaria: pi.cantidad,
                costo_total_insumo: pi.cantidad * (pi.insumos.costo || 0),
            }));
        
        const costoInsumos = productoData.costo_insumos || 0;

        const lotes = productoData.lotes || [];
        const totalProducido = lotes.reduce((sum: number, lote: any) => sum + lote.cantidad_inicial, 0);
        const totalCostoLaboratorio = lotes.reduce((sum: number, lote: any) => sum + lote.costo_laboratorio, 0);
        const costoLaboratorioPromedio = totalProducido > 0 ? totalCostoLaboratorio / totalProducido : 0;

        const costoTotal = costoInsumos + costoLaboratorioPromedio;
        const gananciaNeta = productoData.precio_publico - costoTotal;
        const margenGanancia = productoData.precio_publico > 0 ? (gananciaNeta / productoData.precio_publico) * 100 : 0;
        const unidadesVendidas = salesData.reduce((sum, item) => sum + item.cantidad, 0);

        // --- Process Sales Data ---
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

        const producto: Producto = {
            id: productoData.id,
            nombre: productoData.nombre,
            codigoBarras: productoData.codigo_barras,
            descripcion: productoData.descripcion,
            precioPublico: productoData.precio_publico,
            precioComercio: productoData.precio_comercio,
            precioMayorista: productoData.precio_mayorista,
            costoInsumos: costoInsumos,
            imagenUrl: productoData.imagen_url,
            linea: productoData.linea,
            stock: 0, // Not needed for this dashboard
            stockTotal: 0,
            lotes: [],
            stockPorDeposito: [],
            insumos: [],
            // FIX: Add missing properties to match the 'Producto' interface.
            imagenesGaleria: productoData.imagenes_galeria || [],
            cantidadMinimaComercio: productoData.cantidad_minima_comercio,
            cantidadMinimaMayorista: productoData.cantidad_minima_mayorista,
            boxLengthCm: productoData.box_length_cm,
            boxWidthCm: productoData.box_width_cm,
            boxHeightCm: productoData.box_height_cm,
            productWeightKg: productoData.product_weight_kg,
            productsPerBox: productoData.products_per_box,
        };

        console.log(`[${SERVICE_NAME}] Successfully processed dashboard data for '${producto.nombre}'.`);
        return {
            producto,
            costoInsumos,
            costoLaboratorioPromedio,
            costoTotal,
            gananciaNeta,
            margenGanancia,
            unidadesVendidas,
            insumosDetalle,
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
