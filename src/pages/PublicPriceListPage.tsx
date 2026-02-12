
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Producto, OrderItem } from '@/types';
import { fetchPublicProductsList } from '@/services/productosService';
import { IconPackage, IconShoppingCart, IconList, IconLayoutGrid, IconTruck, IconPlus, IconMinus, IconTag } from '@/components/Icons';
import CheckoutModal from '@/components/CheckoutModal';

const SHIPPING_COST = 9800;
const FREE_SHIPPING_THRESHOLD = 30000;

const PublicErrorDisplay = ({ error }: { error: any }) => {
    if (!error) return null;

    const formatError = (err: any): { message: string; details?: string; hint?: string } => {
        if (!err) return { message: "Ocurrió un error desconocido." };
        return {
            message: err.message || "No se pudo completar la acción.",
            details: err.details,
            hint: err.hint,
        };
    };

    const formatted = formatError(error);

    return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4" role="alert">
            <p className="font-bold">{formatted.message}</p>
            {(formatted.details || formatted.hint) && (
                <div className="mt-2 text-red-600 text-left whitespace-pre-wrap text-xs p-3 bg-red-50 border border-red-200 rounded-md font-mono">
                    {formatted.details && <p><strong>Detalles:</strong><br />{formatted.details}</p>}
                    {formatted.hint && <p className="mt-2"><strong>Sugerencia:</strong><br />{formatted.hint}</p>}
                </div>
            )}
        </div>
    );
};


const PublicPriceListPage: React.FC = () => {
    const { user } = useAuth(); // Detect if a user is logged in
    const [productos, setProductos] = useState<Partial<Producto>[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    
    // Ref for scrolling to summary on mobile
    const summaryRef = useRef<HTMLDivElement>(null);
    
    // Login form state (only used for public view)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);
    const { login } = useAuth();

    // Scroll state for sticky header animation
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        setLoginLoading(true);
        try {
            const { error } = await login(email, password);
            if (error) throw error;
        } catch (err: any) {
            setLoginError(err.message || 'Credenciales incorrectas.');
        } finally {
            setLoginLoading(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchPublicProductsList();
                setProductos(data);
            } catch (err: any) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const getDynamicPrice = (product: Partial<Producto>, quantity: number) => {
        if (!product) return 0;
        const { precioPublico = 0, precioComercio = 0, precioMayorista = 0, cantidadMinimaComercio, cantidadMinimaMayorista } = product;
        const minComercio = cantidadMinimaComercio ?? Infinity;
        const minMayorista = cantidadMinimaMayorista ?? Infinity;

        if (quantity >= minMayorista && precioMayorista > 0) return precioMayorista;
        if (quantity >= minComercio && precioComercio > 0) return precioComercio;
        return precioPublico;
    };

    const handleQuantityChange = (productId: string, value: string) => {
        const newQuantity = parseInt(value, 10);
        setQuantities(prev => ({ ...prev, [productId]: isNaN(newQuantity) || newQuantity < 0 ? 0 : newQuantity }));
    };

    const handleAdjustQuantity = (productId: string, delta: number) => {
        setQuantities(prev => {
            const currentQty = prev[productId] || 0;
            const newQty = Math.max(0, currentQty + delta);
            return { ...prev, [productId]: newQty };
        });
    };

    const { orderItems, subtotal } = useMemo(() => {
        const items: OrderItem[] = Object.keys(quantities)
            .filter(productId => quantities[productId] > 0)
            .map(productId => {
                const qty = quantities[productId];
                const product = productos.find(p => p.id === productId);
                if (!product) return null;
                const price = getDynamicPrice(product, qty);
                return { 
                  id: product.id!, 
                  nombre: product.nombre!, 
                  quantity: qty, 
                  unitPrice: price,
                  lineTotal: price * qty
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null);

        const sub = items.reduce((acc, item) => acc + (item?.lineTotal || 0), 0);
        return { orderItems: items, subtotal: sub };
    }, [quantities, productos]);

    // Shipping Logic
    const shippingCost = useMemo(() => {
        if (subtotal === 0) return 0;
        return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    }, [subtotal]);

    const total = subtotal + shippingCost;
    const amountLeftForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    
    // Total count of items for the mobile floating button
    const totalItemsCount = useMemo(() => orderItems.reduce((acc, item) => acc + item.quantity, 0), [orderItems]);

    const scrollToSummary = () => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const groupedProducts = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        const grouped = productos.reduce((acc, p) => {
            const linea = p.linea || 'General';
            if (!acc[linea]) acc[linea] = [];
            acc[linea].push(p);
            return acc;
        }, {} as Record<string, Partial<Producto>[]>);
        const sortedGroup: Record<string, Partial<Producto>[]> = {};
        lineOrder.forEach(line => { if (grouped[line]) sortedGroup[line] = grouped[line]; });
        Object.keys(grouped).forEach(line => { if (!sortedGroup[line]) sortedGroup[line] = grouped[line]; });
        return sortedGroup;
    }, [productos]);
    
    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const lineaColors: Record<string, string> = { 'ULTRAHISNE': 'bg-orange-500', 'BODYTAN CARIBEAN': 'bg-yellow-800', 'SECRET': 'bg-gray-800', 'ESSENS': 'bg-blue-300', 'General': 'bg-gray-500' };
    
    // --- Helper Component for Upsell Message ---
    const UpsellMessage: React.FC<{ product: Partial<Producto>, quantity: number }> = ({ product, quantity }) => {
        const minComercio = product.cantidadMinimaComercio || 0;
        const minMayorista = product.cantidadMinimaMayorista || 0;
        const pComercio = product.precioComercio || 0;
        const pMayorista = product.precioMayorista || 0;
        const pPublico = product.precioPublico || 0;

        // No mostrar nada si no hay descuentos configurados
        if (minComercio === 0 && minMayorista === 0) return null;

        // 1. Ya alcanzó precio mayorista
        if (minMayorista > 0 && quantity >= minMayorista) {
             return (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 animate-pulse w-fit mt-1">
                    <IconTag className="w-3 h-3" />
                    ¡Mejor Precio Conseguido!
                </div>
             );
        }

        // 2. Alcanzó comercio, sugerir mayorista
        if (minComercio > 0 && quantity >= minComercio) {
             if (minMayorista > 0 && pMayorista < pComercio) {
                 const missing = minMayorista - quantity;
                 return (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-[10px] sm:text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100 w-fit mt-1">
                        <span className="font-semibold text-violet-800">✅ Precio Comercio.</span>
                        <span>Faltan <strong>{missing} u.</strong> para precio Mayorista ({formatPrice(pMayorista)})</span>
                    </div>
                 );
             } else {
                 return <div className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit mt-1">Precio Comercio Aplicado</div>;
             }
        }

        // 3. Aún es público, sugerir comercio
        if (quantity < minComercio && pComercio < pPublico) {
             const missing = minComercio - quantity;
             return (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100 w-fit mt-1">
                    Agregá <strong>{missing} u.</strong> para precio Comercio ({formatPrice(pComercio)})
                </div>
             );
        }

        return null;
    };

    // --- Reusable content component ---
    const PriceListContent = (
        <>
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-700">Lista de Precios al Público</h2>
                        <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`} aria-label="Vista de lista">
                                <IconList className="h-5 w-5" />
                            </button>
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-500 hover:bg-gray-300'}`} aria-label="Vista de grilla">
                                <IconLayoutGrid className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {loading && <div className="text-center py-10">Cargando lista de precios...</div>}
                    {error && <PublicErrorDisplay error={error} />}

                    {!loading && !error && (
                        <div className="space-y-10">
                            {Object.entries(groupedProducts).map(([linea, prods]) => (
                                <div key={linea}>
                                    <div className={`p-4 text-white text-center rounded-t-lg ${lineaColors[linea] || 'bg-gray-500'}`}>
                                        <h3 className="text-2xl font-bold tracking-wider uppercase">{linea === 'ESSENS' ? 'ESSENCE' : linea}</h3>
                                    </div>
                                    
                                    {viewMode === 'list' ? (
                                        <div className="bg-white shadow-lg rounded-b-lg overflow-hidden">
                                            <div className="hidden md:flex bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                <div className="p-3 flex-1">Producto</div>
                                                <div className="p-3 w-32 text-center">Cantidad</div>
                                                <div className="p-3 w-32 text-center">Precio Unit.</div>
                                                <div className="p-3 w-32 text-right">Total</div>
                                            </div>
                                            <div className="divide-y divide-gray-200">
                                                {(prods as Partial<Producto>[]).map(product => {
                                                    const quantity = quantities[product.id!] || 0;
                                                    const currentPrice = getDynamicPrice(product, quantity);
                                                    const lineTotal = currentPrice * quantity;
                                                    
                                                    const publicPrice = product.precioPublico || 0;
                                                    let discountPercent = 0;
                                                    if (publicPrice > 0 && currentPrice < publicPrice) {
                                                        discountPercent = ((publicPrice - currentPrice) / publicPrice) * 100;
                                                    }

                                                    return (
                                                        <div key={product.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-4 hover:bg-gray-50 transition-colors">
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                {product.imagenUrl ? <img src={product.imagenUrl} alt={product.nombre} className="h-16 w-16 object-contain flex-shrink-0" /> : <div className="h-16 w-16 bg-gray-100 flex items-center justify-center rounded flex-shrink-0"><IconPackage className="h-8 w-8 text-gray-400" /></div>}
                                                                <div className="flex-grow">
                                                                    <p className="font-semibold text-gray-800">{product.nombre}</p>
                                                                    <p className="text-gray-600 text-xs">{product.descripcion}</p>
                                                                    <UpsellMessage product={product} quantity={quantity} />
                                                                </div>
                                                            </div>
                                                            <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 mt-4 md:mt-0">
                                                                <div className="w-32 text-center flex flex-col items-center">
                                                                    <label className="text-xs text-gray-500 font-semibold md:hidden mb-1">Cantidad</label>
                                                                    <div className="flex items-center border border-gray-300 rounded-md">
                                                                        <button
                                                                            onClick={() => handleAdjustQuantity(product.id!, -1)}
                                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-l-md transition-colors focus:outline-none"
                                                                        >
                                                                            <IconMinus className="w-3 h-3" />
                                                                        </button>
                                                                        <input
                                                                            type="number"
                                                                            value={quantity}
                                                                            onChange={e => handleQuantityChange(product.id!, e.target.value)}
                                                                            min="0"
                                                                            className="w-12 text-center font-semibold text-gray-800 border-x border-gray-300 border-y-0 p-1 focus:ring-0 appearance-none bg-white"
                                                                        />
                                                                        <button
                                                                            onClick={() => handleAdjustQuantity(product.id!, 1)}
                                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-r-md transition-colors focus:outline-none"
                                                                        >
                                                                            <IconPlus className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="w-32 text-center">
                                                                    <label className="text-xs text-gray-500 font-semibold md:hidden">Precio Unit.</label>
                                                                    <div className="font-semibold p-2 flex flex-col items-center justify-center">
                                                                        <span>{formatPrice(currentPrice)}</span>
                                                                        {discountPercent > 0 && (
                                                                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5">
                                                                                -{discountPercent.toFixed(0)}% OFF
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="w-32 text-right">
                                                                    <label className="text-xs text-gray-500 font-semibold md:hidden">Total</label>
                                                                    <p className="font-bold text-lg text-primary p-2">{formatPrice(lineTotal)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : ( // GRID VIEW
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 pt-6">
                                            {(prods as Partial<Producto>[]).map(product => {
                                                const quantity = quantities[product.id!] || 0;
                                                const currentPrice = getDynamicPrice(product, quantity);
                                                const lineTotal = currentPrice * quantity;

                                                const publicPrice = product.precioPublico || 0;
                                                let discountPercent = 0;
                                                if (publicPrice > 0 && currentPrice < publicPrice) {
                                                    discountPercent = ((publicPrice - currentPrice) / publicPrice) * 100;
                                                }

                                                return (
                                                    <div key={product.id} className="bg-white shadow-lg rounded-lg overflow-hidden flex flex-col hover:shadow-xl transition-shadow">
                                                        <div className="h-48 flex items-center justify-center p-4 bg-gray-50 relative">
                                                            {discountPercent > 0 && (
                                                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded shadow">
                                                                    -{discountPercent.toFixed(0)}%
                                                                </div>
                                                            )}
                                                            {product.imagenUrl ? 
                                                                <img src={product.imagenUrl} alt={product.nombre} className="max-h-full max-w-full object-contain" /> : 
                                                                <IconPackage className="h-16 w-16 text-gray-300" />
                                                            }
                                                        </div>
                                                        <div className="p-4 flex flex-col flex-grow">
                                                            <h4 className="font-semibold text-gray-800 text-lg leading-tight">{product.nombre}</h4>
                                                            <p className="text-gray-600 text-xs mt-1 flex-grow">{product.descripcion}</p>
                                                            
                                                            <div className="mt-3 mb-2 min-h-[24px]">
                                                                <UpsellMessage product={product} quantity={quantity} />
                                                            </div>

                                                            <div className="pt-2 border-t mt-auto">
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <label htmlFor={`quantity-grid-${product.id}`} className="text-sm font-medium text-gray-700">Cantidad:</label>
                                                                    <div className="flex items-center border border-gray-300 rounded-md">
                                                                        <button
                                                                            onClick={() => handleAdjustQuantity(product.id!, -1)}
                                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-l-md transition-colors focus:outline-none"
                                                                        >
                                                                            <IconMinus className="w-3 h-3" />
                                                                        </button>
                                                                        <input 
                                                                            id={`quantity-grid-${product.id}`}
                                                                            type="number" 
                                                                            value={quantity} 
                                                                            onChange={e => handleQuantityChange(product.id!, e.target.value)} 
                                                                            min="0" 
                                                                            className="w-12 text-center font-semibold text-gray-800 border-x border-gray-300 border-y-0 p-1 focus:ring-0 appearance-none bg-white" 
                                                                        />
                                                                        <button
                                                                            onClick={() => handleAdjustQuantity(product.id!, 1)}
                                                                            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-r-md transition-colors focus:outline-none"
                                                                        >
                                                                            <IconPlus className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center text-sm">
                                                                    <span className="text-gray-500">Precio Unit.:</span>
                                                                    <span className="font-semibold text-gray-800">{formatPrice(currentPrice)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center mt-2 text-lg">
                                                                    <span className="font-bold text-gray-800">Total:</span>
                                                                    <span className="font-bold text-primary">{formatPrice(lineTotal)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="lg:w-1/3" ref={summaryRef}>
                    <div className="sticky top-24 bg-white p-6 rounded-lg shadow-lg">
                         <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center"><IconShoppingCart className="h-6 w-6 mr-2 text-primary"/> Tu Pedido</h3>
                         
                         {/* Free Shipping Progress Bar */}
                         <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            {amountLeftForFreeShipping > 0 ? (
                                <>
                                    <div className="flex justify-between text-sm font-semibold text-blue-700 mb-2">
                                        <span>Envío Gratis</span>
                                        <span>Faltan {formatPrice(amountLeftForFreeShipping)}</span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${freeShippingProgress}%` }}></div>
                                    </div>
                                    <p className="text-xs text-blue-600">
                                        ¡Agrega más productos para ahorrar <strong>{formatPrice(SHIPPING_COST)}</strong> de envío!
                                    </p>
                                </>
                            ) : (
                                <div className="flex items-center text-green-600 font-bold animate-pulse">
                                    <IconTruck className="h-6 w-6 mr-2" />
                                    ¡Felicidades! Tienes Envío GRATIS
                                </div>
                            )}
                         </div>

                         <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                             {orderItems.length > 0 ? orderItems.map(item => item && (
                                 <div key={item.id} className="flex justify-between items-center text-sm border-b pb-1">
                                     <div><p className="font-semibold text-gray-700">{item.nombre}</p><p className="text-gray-500">{item.quantity} u. x {formatPrice(item.unitPrice)}</p></div>
                                     <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
                                 </div>
                             )) : <p className="text-gray-500 text-center py-4">Añade productos para ver tu resumen.</p>}
                         </div>
                         <div className="mt-4 pt-4 border-t-2 border-dashed space-y-2">
                             <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>{formatPrice(subtotal)}</span></div>
                             <div className="flex justify-between text-gray-600">
                                 <span>Envío:</span>
                                 {shippingCost === 0 ? (
                                     <span className="text-green-600 font-bold">Gratis</span>
                                 ) : (
                                     <span>{formatPrice(shippingCost)}</span>
                                 )}
                             </div>
                             <div className="flex justify-between font-bold text-2xl text-gray-800 border-t pt-2"><span>Total:</span><span>{formatPrice(total)}</span></div>
                         </div>
                         <button onClick={() => setIsCheckoutOpen(true)} disabled={orderItems.length === 0} className="w-full mt-6 bg-secondary text-white py-3 rounded-lg shadow-md hover:bg-secondary-dark transition-colors disabled:bg-gray-400 font-semibold text-lg">
                             Finalizar Pedido
                         </button>
                          <p className="text-xs text-center text-gray-500 mt-2">Completa tus datos en el siguiente paso para pagar.</p>
                    </div>
                </div>
            </div>
             {isCheckoutOpen && (
                <CheckoutModal 
                    isOpen={isCheckoutOpen}
                    onClose={() => setIsCheckoutOpen(false)}
                    orderItems={orderItems}
                    subtotal={subtotal}
                    shippingCost={shippingCost}
                />
            )}

            {/* Mobile Floating Cart Button */}
            {!user && totalItemsCount > 0 && (
                <button
                    onClick={scrollToSummary}
                    className="lg:hidden fixed bottom-4 right-4 z-50 bg-secondary text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 hover:bg-secondary-dark transition-all transform hover:scale-105 active:scale-95"
                >
                    <div className="relative">
                        <IconShoppingCart className="w-6 h-6" />
                        <span className="absolute -top-2 -right-2 bg-white text-secondary text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border border-secondary">
                            {totalItemsCount}
                        </span>
                    </div>
                    <span className="font-bold text-sm">Ver Pedido</span>
                </button>
            )}
        </>
    );

    // --- Conditional Rendering based on auth state ---
    if (user) {
        // Logged-in view: Render only the content, letting the main App layout handle the rest.
        return PriceListContent;
    }

    // Public view: Render the full page with its own header and footer.
    return (
        <div className="bg-gray-50 min-h-screen">
            <header className={`bg-white shadow-md sticky top-0 z-20 transition-all duration-300 ease-in-out ${isScrolled ? 'py-1 shadow-sm' : 'py-3 shadow-md'}`}>
                 <div className="container mx-auto px-4">
                    <div className={`flex flex-col sm:flex-row justify-between items-center transition-all duration-300 ${isScrolled ? 'gap-0' : 'gap-4'}`}>
                        <div className={`text-center sm:text-left transition-all duration-300 origin-left ${isScrolled ? 'scale-75' : 'scale-100 mb-4 sm:mb-0'}`}>
                            <img 
                                src="https://qlsyymuldzoyiazyzxlf.supabase.co/storage/v1/object/public/Isabella%20de%20la%20Perla/Isabella%20de%20la%20perla%20Logo%20Header.webp" 
                                alt="Isabella de la Perla Logo" 
                                className="h-16 sm:h-20 object-contain"
                            />
                        </div>
                        
                        {/* 
                            Contenedor de Login colapsable. 
                            Se oculta completamente (max-h-0, opacity-0, padding-0) cuando se hace scroll.
                        */}
                        <div className={`w-full sm:w-auto overflow-hidden transition-all duration-500 ease-in-out flex flex-col items-center sm:items-end ${isScrolled ? 'max-h-0 opacity-0 m-0 p-0 pointer-events-none' : 'max-h-96 opacity-100'}`}>
                            {loginError && <p className="text-red-500 text-xs text-center sm:text-right mb-1">{loginError}</p>}
                            <form onSubmit={handleLoginSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input 
                                    type="email" 
                                    placeholder="Email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    required 
                                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm w-full sm:w-auto"
                                />
                                <input 
                                    type="password" 
                                    placeholder="Contraseña" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    required 
                                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm w-full sm:w-auto"
                                />
                                <button 
                                    type="submit" 
                                    disabled={loginLoading} 
                                    className="w-full sm:w-auto bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark transition-colors disabled:bg-violet-300 flex-shrink-0"
                                >
                                    {loginLoading ? '...' : 'Ingresar'}
                                </button>
                                <Link to="/register" className="text-sm text-center text-primary hover:underline whitespace-nowrap pt-2 sm:pt-0">
                                    o Regístrate
                                </Link>
                            </form>
                             <div className="text-center sm:text-right mt-2 w-full">
                                <Link to="/solicitud-comex" className="text-sm font-semibold text-secondary hover:underline">
                                    Solicitar Acceso COMEX
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <div className="container mx-auto p-4 md:p-8">
                <main>
                    {PriceListContent}
                </main>
            </div>
             <footer className="text-center mt-12 py-6 border-t border-gray-200 bg-white">
                <p className="text-sm text-gray-600 font-semibold">www.isabelladelaperla.com</p>
                <p className="text-xs text-gray-500">Contacto: contacto@isabelladelaperla.com</p>
            </footer>
        </div>
    );
};

export default PublicPriceListPage;
