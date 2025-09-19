import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ComexRequestPage: React.FC = () => {
    const { signup } = useAuth();
    const [formData, setFormData] = useState({
        company_name: '',
        contact_person: '',
        email: '',
        password: '',
        confirmPassword: '',
        country: '',
        message: '',
    });
    const [error, setError] = useState<any | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError({ message: "Las contraseñas no coinciden." });
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const metadata = {
                company_name: formData.company_name,
                contact_person: formData.contact_person,
                country: formData.country,
                message: formData.message || null,
            };
            const { error: signupError } = await signup(formData.email, formData.password, 'comex_pending', metadata);
            if (signupError) throw signupError;
            
            setSuccess(true);
        } catch (err: any) {
            if (err.message?.includes('Database error saving new user')) {
                 const enhancedError = {
                    ...err,
                    message: 'Error interno del servidor al crear el perfil de usuario.',
                    details: 'Este es un problema común de Supabase que ocurre cuando la función de base de datos (trigger) que se ejecuta después del registro falla.',
                    hint: 'El administrador debe revisar el script SQL `handle_new_user` y las estructuras de las tablas `profiles` y `access_requests`. Este error ocurre si una columna requerida (que no permite valores nulos y no tiene un valor por defecto) no recibe un valor durante la inserción. Asegúrate de que la función `handle_new_user` proporcione valores para TODAS las columnas requeridas.'
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
            <div className="w-full max-w-2xl p-8 space-y-6 bg-white rounded-lg shadow-md m-4">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-primary">Solicitud de Acceso COMEX</h1>
                    <p className="mt-2 text-gray-600">Complete el formulario para crear su cuenta. Su acceso a las herramientas de COMEX será habilitado por un administrador.</p>
                </div>

                {success ? (
                    <div className="p-4 text-center text-green-800 bg-green-100 border border-green-200 rounded-lg">
                        <h3 className="font-bold">¡Cuenta Creada!</h3>
                        <p>Hemos recibido su solicitud y su cuenta ha sido creada. Por favor, revise su correo electrónico para confirmar su cuenta. Una vez confirmada, podrá iniciar sesión. Su acceso a las herramientas de COMEX se activará cuando un administrador apruebe su solicitud.</p>
                        <Link to="/login" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
                            Ir a Iniciar Sesión
                        </Link>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={handleSubmit}>
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="company_name" className="label-style">Nombre de la Empresa</label>
                                <input id="company_name" name="company_name" type="text" value={formData.company_name} onChange={handleInputChange} required className="input-style" />
                            </div>
                             <div>
                                <label htmlFor="contact_person" className="label-style">Persona de Contacto</label>
                                <input id="contact_person" name="contact_person" type="text" value={formData.contact_person} onChange={handleInputChange} required className="input-style" />
                            </div>
                            <div>
                                <label htmlFor="email" className="label-style">Email de la Cuenta</label>
                                <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required className="input-style" />
                            </div>
                            <div>
                                <label htmlFor="country" className="label-style">País</label>
                                <input id="country" name="country" type="text" value={formData.country} onChange={handleInputChange} required className="input-style" />
                            </div>
                             <div>
                                <label htmlFor="password" className="label-style">Contraseña</label>
                                <input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required className="input-style" />
                            </div>
                             <div>
                                <label htmlFor="confirmPassword" className="label-style">Confirmar Contraseña</label>
                                <input id="confirmPassword" name="confirmPassword" type="password" value={formData.