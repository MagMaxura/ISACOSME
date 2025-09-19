import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { error } = await login(email, password);
            if (error) {
                // Throw the error to be caught by the catch block
                throw error;
            }
            navigate('/');
        } catch (err: any) {
            // Provide more user-friendly error messages
            if (err.message && err.message.includes('Email not confirmed')) {
                setError("Confirma tu correo electrónico. Te hemos enviado un enlace a tu bandeja de entrada para activar tu cuenta.");
            } else if (err.message && err.message.includes('Invalid login credentials')) {
                setError("Credenciales incorrectas. Por favor, verifica tu email y contraseña.");
            } else {
                setError(err.message || "Ocurrió un error inesperado al iniciar sesión.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-center text-primary">Isabella de la Perla ERP</h1>
                <h2 className="text-xl font-semibold text-center text-gray-700">Iniciar Sesión</h2>
                
                {error && (
                    <div className="p-3 text-center text-red-800 bg-red-100 border border-red-200 rounded-lg">
                        {error}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-700">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-violet-300"
                        >
                            {loading ? 'Ingresando...' : 'Ingresar'}
                        </button>
                    </div>
                </form>

                <p className="text-sm text-center text-gray-600">
                    ¿No tienes una cuenta?{' '}
                    <Link to="/register" className="font-medium text-primary hover:underline">
                        Regístrate
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;