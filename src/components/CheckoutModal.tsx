import React, { useState, useMemo } from 'react';
import { IconX, IconMercadoPago } from './Icons';
import { createPreference } from '../services/mercadoPagoService';

export interface OrderItem {
  id: string;
  nombre: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItems: OrderItem[];
  subtotal: number;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, orderItems, subtotal }) => {
    const [payerInfo, setPayerInfo] = useState({
        name: '',
        surname: '',
        email: '',
        phone: '',
        dni: '',
        street_name: '',
        street_number: '',
        zip_code: '',
    });
    const [errors, setErrors] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    if (!isOpen) return null;

    const validateField = (name: string, value: string) => {
        let error: string | null = null;
        if (!value.trim()) {
            error = 'Este campo es requerido.';
        } else {
            switch (name) {
                case 'dni':
                case 'phone':
                case 'zip_code':
                    if (!/^\d+$/.test(value)) error = 'Solo se admiten números.';
                    break;
                case 'street_number':
                    if (!/^\d+$/.test(value)) error = 'Solo números. No usar "s/n" o letras.';
                    break;
                case 'email':
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Formato de email inválido.';
                    break;
            }
        }
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPayerInfo(prev => ({ ...prev, [name]: value }));
        validateField(name, value);
    };

    const isFormValid = useMemo(() => {
        const requiredFields: (keyof typeof payerInfo)[] = ['name', 'surname', 'email', 'phone', 'dni', 'street_name', 'street_number', 'zip_code'];
        for (const field of requiredFields) {
            if (!payerInfo[field]) return false;
        }
        return Object.values(errors).every(e => e === null);
    }, [payerInfo, errors]);
    
    const handlePayment = async () => {
        // Final validation check on submit
        let formIsValid = true;
        for (const key in payerInfo) {
            validateField(key, payerInfo[key as keyof typeof payerInfo]);
            if (errors[key] !== null && errors[key] !== undefined) {
                 formIsValid = false;
            }
        }

        if (!isFormValid || !formIsValid) {
            setApiError("Por favor, corrige los errores en el formulario.");
            return;
        }

        setLoading(true);
        setApiError(null);
        try {
            const preferenceInitPoint = await createPreference(orderItems, payerInfo);
            window.location.href = preferenceInitPoint;
        } catch (err: any) {
            setApiError(err.message || 'No se pudo iniciar el proceso de pago.');
            setLoading(false);
        }
    };
    
    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const InputField: React.FC<{name: keyof typeof payerInfo, label: string, type?: string, required?: boolean}> = ({ name, label, type = 'text', required = true }) => (
        <div>
            <label className="label-style">{label}</label>
            <input 
                type={type} 
                name={name} 
                value={payerInfo[name]} 
                onChange={handleInputChange} 
                required={required} 
                className={`input-style ${errors[name] ? 'border-red-500' : ''}`}
            />
            {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-full flex flex-col">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-2xl font-semibold text-gray-800">Finalizar Compra</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex flex-col lg:flex-row p-6 gap-8 overflow-y-auto">
                    {/* Form Section */}
                    <div className="lg:w-1/2 space-y-4">
                        <h4 className="text-lg font-semibold text-gray-700">Tus Datos</h4>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="name" label="Nombre" />
                            <InputField name="surname" label="Apellido" />
                        </div>
                        <InputField name="email" label="Email" type="email" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="phone" label="Teléfono" type="tel" />
                            <InputField name="dni" label="DNI/CUIT" />
                        </div>

                        <h4 className="text-lg font-semibold text-gray-700 pt-4">Dirección de Envío</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <InputField name="street_name" label="Calle" />
                            </div>
                            <div>
                                <InputField name="street_number" label="Número" />
                            </div>
                        </div>
                         <InputField name="zip_code" label="Código Postal" />
                    </div>
                    {/* Order Summary */}
                    <div className="lg:w-1/2 bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-700 mb-4">Resumen del Pedido</h4>
                         <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {orderItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-semibold text-gray-800">{item.nombre}</p>
                                        <p className="text-gray-500">{item.quantity} x {formatPrice(item.unitPrice)}</p>
                                    </div>
                                    <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t-2">
                            <div className="flex justify-between font-bold text-xl text-gray-800">
                                <span>Total:</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                        </div>
                        {apiError && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-md text-sm">{apiError}</div>}
                        <button 
                            onClick={handlePayment} 
                            disabled={loading || !isFormValid}
                            className="w-full mt-6 bg-[#009EE3] text-white py-3 rounded-lg shadow-md hover:bg-[#0089c7] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <IconMercadoPago className="h-6 w-6 mr-2" />
                                    Pagar con Mercado Pago
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
             <style>{`
                .label-style { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; color: #374151; }
                .input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); } 
                .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #8a5cf6; }
                .input-style.border-red-500 { border-color: #EF4444; }
            `}</style>
        </div>
    );
};

export default CheckoutModal;