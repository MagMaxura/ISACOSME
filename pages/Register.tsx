import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<any | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError({ message: "Las contraseñas no coinciden." });
            return;
        }

        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            const { error: signupError } = await signup(email, password);
            if (signupError) {
                throw signupError;
            }
            setMessage("¡Registro exitoso! Por favor, revisa tu correo para confirmar tu cuenta y poder iniciar sesión.");
        } catch (err: any) {
            if (err.message?.includes('Database error saving new user')) {
                const enhancedError = {
                    ...err,
                    message: 'Error interno del servidor al crear el perfil de usuario.',
                    details: 'Este es un problema común de Supabase que ocurre cuando la función de base de datos (trigger) que se ejecuta después del registro falla.',
                    hint: 'El administrador debe revisar el script SQL `handle_new_user` y la estructura de la tabla `profiles`. Este error ocurre si una columna requerida (que no permite valores nulos y no tiene un valor por defecto) no recibe un valor durante la inserción. Asegúrate de que la función `handle_new_user` proporcione valores para TODAS las columnas requeridas.'
                };
                setError(enhancedError);
            } else {
                setError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-center text-primary">Isabella de la Perla ERP</h1>
                <h2 className="text-xl font-semibold text-center text-gray-700">Crear Cuenta</h2>
                
                {message && (
                    <div className="p-3 text-center text-green-800 bg-green-100 border border-green-200 rounded-lg">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="p-3 text-red-800 bg-red-100 border border-red-200 rounded-lg">
                        <p className="font-bold text-center">Error al registrar</p>
                         <div className="mt-2 text-left whitespace-pre-wrap text-xs p-2 bg-red-50 border border-red-100 rounded-md font-mono">
                            <strong>Mensaje:</strong> {error?.message || 'No disponible'}<br/>
                            {error.code && <><strong>Código:</strong> {error.code}<br/></>}
                            {error.details && <><strong>Detalles:</strong> {error.details}<br/></>}
                            {error.hint && <><strong>Sugerencia:</strong> {error.hint}<br/></>}
                        </div>
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
                        <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                           Confirmar Contraseña
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={loading || !!message}
                            className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-violet-300"
                        >
                            {loading ? 'Creando cuenta...' : 'Registrarse'}
                        </button>
                    </div>
                </form>

                 <p className="text-sm text-center text-gray-600">
                    ¿Ya tienes una cuenta?{' '}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;