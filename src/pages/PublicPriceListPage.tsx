import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Producto } from '@/types';
import { fetchPublicProductsList } from '@/services/productosService';
import { IconPackage } from '@/components/Icons';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    
    // Login form state (only used for public view)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);
    const { login } = useAuth();

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

    const groupedProducts = useMemo(() => {
        const lineOrder = ['ULTRAHISNE', 'BODYTAN CARIBEAN', 'SECRET', 'ESSENS', 'General'];
        const grouped = productos.reduce((acc, producto) => {
            const linea = producto.linea || 'General';
            if (!acc[linea]) {
                acc[linea] = [];
            }
            acc[linea].push(producto);
            return acc;
        }, {} as Record<string, Partial<Producto>[]>);
        const sortedGroup: Record<string, Partial<Producto>[]> = {};
        for (const line of lineOrder) {
            if (grouped[line]) sortedGroup[line] = grouped[line];
        }
        for (const line in grouped) {
            if (!sortedGroup[line]) sortedGroup[line] = grouped[line];
        }
        return sortedGroup;
    }, [productos]);
    
    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const lineaColors: Record<string, string> = {
        'ULTRAHISNE': 'bg-orange-500',
        'BODYTAN CARIBEAN': 'bg-yellow-800',
        'SECRET': 'bg-gray-800',
        'ESSENS': 'bg-blue-300',
        'General': 'bg-gray-500',
    };
    
    // --- Reusable content component ---
    const PriceListContent = (
        <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-700 mb-8">Lista de Precios al Público</h2>
            {loading && <div className="text-center py-10">Cargando lista de precios...</div>}
            {error && <PublicErrorDisplay error={error} />}
            {!loading && !error && Object.entries(groupedProducts).map(([linea, prods]) => (
                <div key={linea} className="mb-10 bg-white shadow-lg rounded-lg overflow-hidden">
                    <div className={`p-4 text-white text-center ${lineaColors[linea] || 'bg-gray-500'}`}>
                        <h3 className="text-2xl font-bold tracking-wider uppercase">{linea}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 w-24 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Imagen</th>
                                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                                    <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Lote Mín.</th>
                                    <th className="p-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {(prods as Partial<Producto>[]).map(producto => (
                                    <tr key={producto.id}>
                                        <td className="p-3">
                                            {producto.imagenUrl ? (
                                                <img src={producto.imagenUrl} alt={producto.nombre} className="h-16 w-16 object-contain mx-auto" />
                                            ) : (
                                                <div className="h-16 w-16 bg-gray-100 flex items-center justify-center rounded mx-auto">
                                                    <IconPackage className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 align-middle">
                                            <p className="font-semibold text-gray-800">{producto.nombre}</p>
                                            <p className="text-gray-600 text-xs">{producto.descripcion}</p>
                                        </td>
                                        <td className="p-3 text-center align-middle font-semibold text-gray-700">1</td>
                                        <td className="p-3 text-right align-middle font-bold text-lg text-primary">{formatPrice(producto.precioPublico ?? 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
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