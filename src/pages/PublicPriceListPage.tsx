import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Producto } from '@/types';
import { fetchPublicProductsList } from '@/services/productosService';
import { IconPackage, IconShoppingCart } from '@/components/Icons';

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
    
    // Login form state (only used for public view)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        setLoginLoading(true);
        try {
            const { error } = await login(email, password);
            if (error) throw error;
            // On successful login, AuthProvider will re-render App.tsx and navigate away.
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
            } catch (err: any)
{
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

    const { orderItems, subtotal } = useMemo(() => {
        const items = Object.keys(quantities)
            .filter(productId => quantities[productId] > 0)
            .map(productId => {
                const qty = quantities[productId];
                const product = productos.find(p => p.id === productId);
                if (!product) return null;
                const price = getDynamicPrice(product, qty);
                return { ...product, quantity: qty, currentPrice: price, lineTotal: price * qty };
            }).filter((item): item is NonNullable<typeof item> => item !== null);
        const sub = items.reduce((acc, item) => acc + (item?.lineTotal || 0), 0);
        return { orderItems: items, subtotal: sub };
    }, [quantities, productos]);

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
    
    // --- Reusable content component ---
    const PriceListContent = (
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-2/3">
                <h2 className="text-3xl font-bold text-center text-gray-700 mb-8">Lista de Precios al Público</h2>
                {loading && <div className="text-center py-10">Cargando lista de precios...</div>}
                {error && <PublicErrorDisplay error={error} />}
                {!loading && !error && Object.entries(groupedProducts).map(([linea, prods]) => (
                    <div key={linea} className="mb-10 bg-white shadow-lg rounded-lg overflow-hidden">
                        <div className={`p-4 text-white text-center ${lineaColors[linea] || 'bg-gray-500'}`}>
                            <h3 className="text-2xl font-bold tracking-wider uppercase">{linea}</h3>
                        </div>
                        
                        {/* Desktop Header */}
                        <div className="hidden md:flex bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <div className="p-3 flex-1">Producto</div>
                            <div className="p-3 w-28 text-center">Cantidad</div>
                            <div className="p-3 w-32 text-center">Precio Unit.</div>
                            <div className="p-3 w-32 text-right">Total</div>
                        </div>

                        <div className="divide-y divide-gray-200">
                            {(prods as Partial<Producto>[]).map(product => {
                                const quantity = quantities[product.id!] || 0;
                                const currentPrice = getDynamicPrice(product, quantity);
                                const lineTotal = currentPrice * quantity;
                                return (
                                <div key={product.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-4">
                                    {/* Product Info (takes up available space) */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {product.imagenUrl ? 
                                            <img src={product.imagenUrl} alt={product.nombre} className="h-16 w-16 object-contain flex-shrink-0" /> : 
                                            <div className="h-16 w-16 bg-gray-100 flex items-center justify-center rounded flex-shrink-0"><IconPackage className="h-8 w-8 text-gray-400" /></div>
                                        }
                                        <div className="flex-grow">
                                            <p className="font-semibold text-gray-800">{product.nombre}</p>
                                            <p className="text-gray-600 text-xs">{product.descripcion}</p>
                                        </div>
                                    </div>
            
                                    {/* Pricing & Actions */}
                                    <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-2 md:gap-4 shrink-0 mt-4 md:mt-0">
                                        <div className="w-28 text-center">
                                            <label className="text-xs text-gray-500 font-semibold md:hidden">Cantidad</label>
                                            <input type="number" value={quantity} onChange={e => handleQuantityChange(product.id!, e.target.value)} min="0" className="w-24 text-center font-semibold text-gray-800 border-2 border-gray-200 rounded-md p-2 focus:ring-primary focus:border-primary transition" />
                                        </div>
                                        <div className="w-32 text-center">
                                            <label className="text-xs text-gray-500 font-semibold md:hidden">Precio Unit.</label>
                                            <p className="font-semibold p-2">{formatPrice(currentPrice)}</p>
                                        </div>
                                        <div className="w-32 text-right">
                                             <label className="text-xs text-gray-500 font-semibold md:hidden">Total</label>
                                            <p className="font-bold text-lg text-primary p-2">{formatPrice(lineTotal)}</p>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                ))}
            </div>
            <div className="lg:w-1/3">
                <div className="sticky top-24 bg-white p-6 rounded-lg shadow-lg">
                     <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center"><IconShoppingCart className="h-6 w-6 mr-2 text-primary"/> Tu Pedido</h3>
                     <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                         {orderItems.length > 0 ? orderItems.map(item => item && (
                             <div key={item.id} className="flex justify-between items-center text-sm border-b pb-1">
                                 <div><p className="font-semibold text-gray-700">{item.nombre}</p><p className="text-gray-500">{item.quantity} u. x {formatPrice(item.currentPrice)}</p></div>
                                 <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
                             </div>
                         )) : <p className="text-gray-500 text-center py-4">Añade productos para ver tu resumen.</p>}
                     </div>
                     <div className="mt-4 pt-4 border-t-2 border-dashed">
                         <div className="flex justify-between font-bold text-2xl text-gray-800"><span>Subtotal:</span><span>{formatPrice(subtotal)}</span></div>
                     </div>
                     <button onClick={() => navigate('/register')} disabled={orderItems.length === 0} className="w-full mt-6 bg-secondary text-white py-3 rounded-lg shadow-md hover:bg-secondary-dark transition-colors disabled:bg-gray-400 font-semibold text-lg">
                         Finalizar Pedido
                     </button>
                      <p className="text-xs text-center text-gray-500 mt-2">Debes registrarte para completar tu compra.</p>
                </div>
            </div>
        </div>
    );

    // --- Conditional Rendering based on auth state ---
    if (user) {
        // Logged-in view: Render only the content, letting the main App layout handle the rest.
        return PriceListContent;
    }

    // Public view: Render the full page with its own header and footer.
    return (
        <div className="bg-gray-50 min-h-screen">
            <header className="bg-white shadow-md sticky top-0 z-10">
                 <div className="container mx-auto px-4 py-3">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-center sm:text-left">
                            <h1 className="text-3xl font-extrabold text-gray-800 tracking-wider">ISABELLA</h1>
                            <p className="text-lg text-gray-500">De la Perla</p>
                        </div>
                        <div className="w-full sm:w-auto">
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
                             <div className="text-center sm:text-right mt-2">
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
