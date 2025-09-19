import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ClientHeader from '@/components/ClientHeader';
import { supabase } from '@/supabase';
import { ListaPrecioItem } from '@/types';
import { fetchProductosDeLista } from '@/services/preciosService';
import { fetchProductosConStock } from '@/services/productosService';
import { IconPackage } from '@/components/Icons';

const ClientPriceListPage: React.FC = () => {
    const { user } = useAuth();
    const [priceList, setPriceList] = useState<ListaPrecioItem[]>([]);
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
                // 1. Fetch all products with their default public prices. This serves as our base list.
                const allProducts = await fetchProductosConStock();

                // 2. Find the client record to see if they have a specific price list.
                const { data: cliente, error: clientError } = await supabase
                    .from('clientes')
                    .select('lista_precio_id, listas_de_precios(nombre)')
                    .eq('email', user.email)
                    .single();

                if (clientError && clientError.code !== 'PGRST116') { // Ignore "No rows found"
                    throw clientError;
                }
                
                // When joining on a foreign key, Supabase returns the joined table as an object.
                setClientListName((cliente?.listas_de_precios as any)?.nombre || 'Lista de Precios Pública');
                
                let finalPriceList: ListaPrecioItem[];

                // 3. If the client has an assigned price list, fetch it and merge.
                if (cliente?.lista_precio_id) {
                    const clientPriceListItems = await fetchProductosDeLista(cliente.lista_precio_id);
                    const clientPriceMap = new Map<string, number>();
                    clientPriceListItems.forEach(item => {
                        // Ensure we only map valid prices
                        if (typeof item.precio === 'number') {
                            clientPriceMap.set(item.productoId, item.precio);
                        }
                    });

                    // Create the final list by iterating through all products.
                    // Use the price from the client's list if it exists, otherwise fall back to the public price.
                    finalPriceList = allProducts.map(p => ({
                        productoId: p.id,
                        productoNombre: p.nombre,
                        linea: p.linea,
                        precio: clientPriceMap.has(p.id) ? clientPriceMap.get(p.id)! : p.precioPublico,
                    }));

                } else {
                    // 4. If no specific list is assigned, the final list is simply all products with their public prices.
                    finalPriceList = allProducts.map(p => ({
                        productoId: p.id,
                        productoNombre: p.nombre,
                        linea: p.linea,
                        precio: p.precioPublico,
                    }));
                }
                
                setPriceList(finalPriceList);

            } catch (err: any) {
                setError(err); // Pass the full error object
            } finally {
                setLoading(false);
            }
        };

        loadClientData();
    }, [user]);

    const groupedProducts = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        
        const grouped = priceList.reduce((acc, producto) => {
            const linea = producto.linea || 'General';
            if (!acc[linea]) {
                acc[linea] = [];
            }
            acc[linea].push(producto);
            return acc;
        }, {} as Record<string, ListaPrecioItem[]>);

        const sortedGroup: Record<string, ListaPrecioItem[]> = {};
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
    }, [priceList]);
    
    const formatPrice = (price: number) => {
        return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const lineaColors: Record<string, string> = {
        'ULTRAHISNE': 'bg-orange-500',
        'BODYTAN CARIBEAN': 'bg-yellow-800',
        'SECRET': 'bg-gray-800',
        'ESSENS': 'bg-blue-300',
        'General': 'bg-gray-500',
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <ClientHeader listName={clientListName} />
            <main className="p-4 sm:p-6 md:p-8">
                {loading && <div className="text-center py-10">Cargando tu lista de precios...</div>}
                {error && <div className="bg-red-100 text-red-700 p-4 rounded-md">{error.message || "Ocurrió un error al cargar los datos."}</div>}
                {!loading && !error && (
                     <div className="max-w-7xl mx-auto">
                        {Object.entries(groupedProducts).map(([linea, prods]) => (
                            <div key={linea} className="mb-10 bg-white shadow-lg rounded-lg overflow-hidden">
                                <div className={`p-4 text-white text-center ${lineaColors[linea] || 'bg-gray-500'}`}>
                                    <h2 className="text-2xl font-bold tracking-wider uppercase">{linea}</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[60%]">Producto</th>
                                                <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-[40%]">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {/* Cast 'prods' to 'ListaPrecioItem[]' because Object.entries widens the value type to 'unknown'. */}
                                            {(prods as ListaPrecioItem[]).map(producto => (
                                                <tr key={producto.productoId}>
                                                    <td className="p-3 align-middle font-medium text-gray-800">{producto.productoNombre}</td>
                                                    <td className="p-3 text-right align-middle font-bold text-lg text-primary">{formatPrice(producto.precio)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ClientPriceListPage;