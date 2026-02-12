
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ClientHeader from '@/components/ClientHeader';
import { supabase } from '@/supabase';
import { Producto } from '@/types';
import { fetchProductosDeLista } from '@/services/preciosService';
import { fetchProductosConStock } from '@/services/productosService';
import { IconShoppingCart } from '@/components/Icons';

interface ClientProduct extends Producto {
    basePrice: number;
}

const ClientPriceListPage: React.FC = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState<ClientProduct[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [clientListName, setClientListName] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);

    useEffect(() => {
        const loadClientData = async () => {
            if (!user?.email) {
                setError({ message: "No se pudo identificar al usuario." });
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const allProducts = await fetchProductosConStock();
                const { data: cliente, error: clientError } = await supabase
                    .from('clientes')
                    .select('lista_precio_id, listas_de_precios(nombre)')
                    .eq('email', user.email)
                    .single();

                if (clientError && clientError.code !== 'PGRST116') throw clientError;

                setClientListName((cliente?.listas_de_precios as any)?.nombre || 'Lista de Precios Pública');
                
                let finalProducts: ClientProduct[];
                if (cliente?.lista_precio_id) {
                    const clientPriceListItems = await fetchProductosDeLista(cliente.lista_precio_id);
                    const clientPriceMap = new Map(clientPriceListItems.map(item => [item.productoId, item.precio]));
                    finalProducts = allProducts.map(p => ({
                        ...p,
                        basePrice: clientPriceMap.get(p.id) ?? p.precioPublico,
                    }));
                } else {
                    finalProducts = allProducts.map(p => ({
                        ...p,
                        basePrice: p.precioPublico,
                    }));
                }
                setProducts(finalProducts);
            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadClientData();
    }, [user]);
    
    const getDynamicPrice = (product: ClientProduct, quantity: number) => {
        // FIX: Destructure properties now available on the ClientProduct type.
        const { basePrice, precioComercio, precioMayorista, cantidadMinimaComercio, cantidadMinimaMayorista } = product;
        const minComercio = cantidadMinimaComercio ?? Infinity;
        const minMayorista = cantidadMinimaMayorista ?? Infinity;
        if (quantity >= minMayorista && precioMayorista > 0) return precioMayorista;
        if (quantity >= minComercio && precioComercio > 0) return precioComercio;
        return basePrice;
    };

    const handleQuantityChange = (productId: string, value: string) => {
        const newQuantity = parseInt(value, 10);
        setQuantities(prev => ({
            ...prev,
            [productId]: isNaN(newQuantity) || newQuantity < 0 ? 0 : newQuantity,
        }));
    };

    // FIX: Replaced `Object.entries` with `Object.keys` to correctly infer types and resolve calculation errors.
    const { orderItems, subtotal } = useMemo(() => {
        const items = Object.keys(quantities)
            .filter(productId => quantities[productId] > 0)
            .map(productId => {
                const product = products.find(p => p.id === productId);
                if (!product) return null;
                const qty = quantities[productId];
                const price = getDynamicPrice(product, qty);
                return { ...product, quantity: qty, currentPrice: price, lineTotal: price * qty };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
        const sub = items.reduce((acc, item) => acc + (item?.lineTotal || 0), 0);
        return { orderItems: items, subtotal: sub };
    }, [quantities, products]);


    const groupedProducts = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        const grouped = products.reduce((acc, p) => {
            const linea = p.linea || 'General';
            if (!acc[linea]) acc[linea] = [];
            acc[linea].push(p);
            return acc;
        }, {} as Record<string, ClientProduct[]>);
        
        const sortedGroup: Record<string, ClientProduct[]> = {};
        lineOrder.forEach(line => { if (grouped[line]) sortedGroup[line] = grouped[line]; });
        Object.keys(grouped).forEach(line => { if (!sortedGroup[line]) sortedGroup[line] = grouped[line]; });
        return sortedGroup;
    }, [products]);

    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const lineaColors: Record<string, string> = { 'ULTRAHISNE': 'bg-orange-500', 'BODYTAN CARIBEAN': 'bg-yellow-800', 'SECRET': 'bg-gray-800', 'ESSENS': 'bg-blue-300', 'General': 'bg-gray-500' };

    return (
        <div className="min-h-screen bg-gray-100">
            <ClientHeader listName={clientListName} />
            <main className="p-4 sm:p-6 md:p-8">
                {loading && <div className="text-center py-10">Cargando tu lista de precios...</div>}
                {error && <div className="bg-red-100 text-red-700 p-4 rounded-md">{error.message || "Ocurrió un error al cargar los datos."}</div>}
                {!loading && !error && (
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-2/3">
                            {Object.entries(groupedProducts).map(([linea, prods]) => (
                                <div key={linea} className="mb-10 bg-white shadow-lg rounded-lg overflow-hidden">
                                    <div className={`p-4 text-white text-center ${lineaColors[linea] || 'bg-gray-500'}`}>
                                        <h2 className="text-2xl font-bold tracking-wider uppercase">{linea === 'ESSENS' ? 'ESSENCE' : linea}</h2>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="th-style w-[45%]">Producto</th>
                                                    <th className="th-style w-[15%]">Cantidad</th>
                                                    <th className="th-style text-center w-[20%]">Precio Unit.</th>
                                                    <th className="th-style text-right w-[20%]">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {(prods as ClientProduct[]).map(product => {
                                                    const quantity = quantities[product.id] || 0;
                                                    const currentPrice = getDynamicPrice(product, quantity);
                                                    const lineTotal = currentPrice * quantity;
                                                    return (
                                                        <tr key={product.id}>
                                                            <td className="p-3 align-middle font-medium text-gray-800">{product.nombre}</td>
                                                            <td className="p-3 align-middle">
                                                                <input type="number" value={quantity} onChange={e => handleQuantityChange(product.id, e.target.value)} min="0" className="w-20 text-center font-semibold text-gray-800 border-2 border-gray-200 rounded-md p-2 focus:ring-primary focus:border-primary transition" />
                                                            </td>
                                                            <td className="p-3 text-center align-middle font-semibold text-gray-700">{formatPrice(currentPrice)}</td>
                                                            <td className="p-3 text-right align-middle font-bold text-lg text-primary">{formatPrice(lineTotal)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="lg:w-1/3">
                            <div className="sticky top-8 bg-white p-6 rounded-lg shadow-lg">
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center"><IconShoppingCart className="h-6 w-6 mr-2 text-primary"/> Resumen de Pedido</h3>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {orderItems.length > 0 ? orderItems.map(item => item && (
                                        <div key={item.id} className="flex justify-between items-center text-sm border-b pb-1">
                                            <div>
                                                <p className="font-semibold text-gray-700">{item.nombre}</p>
                                                <p className="text-gray-500">{item.quantity} u. x {formatPrice(item.currentPrice)}</p>
                                            </div>
                                            <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
                                        </div>
                                    )) : <p className="text-gray-500 text-center py-4">Agrega productos a tu pedido.</p>}
                                </div>
                                <div className="mt-4 pt-4 border-t-2 border-dashed">
                                    <div className="flex justify-between font-bold text-2xl text-gray-800">
                                        <span>Subtotal:</span>
                                        <span>{formatPrice(subtotal)}</span>
                                    </div>
                                </div>
                                <button onClick={() => alert('¡Funcionalidad de envío de pedidos próximamente!')} disabled={orderItems.length === 0} className="w-full mt-6 bg-primary text-white py-3 rounded-lg shadow-md hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg">
                                    Realizar Pedido
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
             <style>{`.th-style { padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em; }`}</style>
        </div>
    );
};

export default ClientPriceListPage;
