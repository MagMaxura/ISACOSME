
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { IconX, IconMercadoPago } from './Icons';
import { createPreference } from '../services/mercadoPagoService';
import { createVenta, VentaToCreate, prepareVentaItemsFromCart } from '../services/ventasService';

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

interface InputFieldProps {
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string | null;
    type?: string;
    required?: boolean;
}

// Defined outside to ensure stable reference across renders
const InputField: React.FC<InputFieldProps> = ({ name, label, value, onChange, error, type = 'text', required = true }) => (
    <div>
        <label className="label-style">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={value} 
            onChange={onChange} 
            required={required} 
            autoComplete="off"
            className={`input-style ${error ? 'border-red-500' : ''}`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
);

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
    const [statusMessage, setStatusMessage] = useState<string>('');

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
                    if (!/^[1-9]\d*$/.test(value)) error = 'Debe ser un número positivo.';
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
    
    const handlePayment = async () => {
        // Final validation check
        let formIsValid = true;
        for (const key in payerInfo) {
            validateField(key, payerInfo[key as keyof typeof payerInfo]);
            if (!payerInfo[key as keyof typeof payerInfo]) formIsValid = false;
        }
        if (!formIsValid || Object.values(errors).some(e => e !== null)) {
            setApiError("Por favor, completa todos los campos correctamente.");
            return;
        }

        setLoading(true);
        setApiError(null);
        setStatusMessage('Verificando stock y registrando pedido...');

        try {
            // 1. Prepare items with auto-assigned lots (FIFO) logic
            const itemsParaVenta = await prepareVentaItemsFromCart(orderItems);

            // 2. Create "Pendiente" Sale in DB to reserve stock and record order
            const saleData: VentaToCreate = {
                clienteId: null, // Anonymous/Public client
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'Venta',
                estado: 'Pendiente',
                items: itemsParaVenta,
                subtotal: subtotal,
                iva: 0, // Simplified for public view
                total: subtotal,
                observaciones: `Compra Web - Cliente: ${payerInfo.name} ${payerInfo.surname} (DNI: ${payerInfo.dni}) - Envío: ${payerInfo.street_name} ${payerInfo.street_number}, CP ${payerInfo.zip_code}`,
                puntoDeVenta: 'Tienda física', // Default or 'Web'
            };

            const newSaleId = await createVenta(saleData);
            console.log("Sale created locally with ID:", newSaleId);

            setStatusMessage('Iniciando pasarela de pago...');

            // 3. Create Preference in Mercado Pago, passing the Sale ID as external_reference
            const preferenceInitPoint = await createPreference(orderItems, payerInfo, newSaleId);
            
            // 4. Redirect
            window.location.href = preferenceInitPoint;

        } catch (err: any) {
            console.error("Payment flow error:", err);
            let msg = err.message || 'Ocurrió un error inesperado.';
            if (msg.includes('insufficient stock')) msg = 'Stock insuficiente para completar el pedido.';
            setApiError(msg);
            setLoading(false);
            setStatusMessage('');
        }
    };
    
    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Use React Portal to render modal at document root to prevent z-index/overflow issues within parent containers
    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
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
                            <InputField name="name" label="Nombre" value={payerInfo.name} onChange={handleInputChange} error={errors.name} />
                            <InputField name="surname" label="Apellido" value={payerInfo.surname} onChange={handleInputChange} error={errors.surname} />
                        </div>
                        <InputField name="email" label="Email" type="email" value={payerInfo.email} onChange={handleInputChange} error={errors.email} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="phone" label="Teléfono" type="tel" value={payerInfo.phone} onChange={handleInputChange} error={errors.phone} />
                            <InputField name="dni" label="DNI/CUIT" value={payerInfo.dni} onChange={handleInputChange} error={errors.dni} />
                        </div>

                        <h4 className="text-lg font-semibold text-gray-700 pt-4">Dirección de Envío</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <InputField name="street_name" label="Calle" value={payerInfo.street_name} onChange={handleInputChange} error={errors.street_name} />
                            </div>
                            <div>
                                <InputField name="street_number" label="Número" value={payerInfo.street_number} onChange={handleInputChange} error={errors.street_number} />
                            </div>
                        </div>
                         <InputField name="zip_code" label="Código Postal" value={payerInfo.zip_code} onChange={handleInputChange} error={errors.zip_code} />
                    </div>
                    {/* Order Summary */}
                    <div className="lg:w-1/2 bg-gray-50 p-6 rounded-lg h-fit">
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
                        <div className="mt-4 pt-4 border-t-2 border-gray-200">
                            <div className="flex justify-between font-bold text-xl text-gray-800">
                                <span>Total:</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                        </div>
                        
                        {apiError && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-md text-sm">{apiError}</div>}
                        {loading && statusMessage && <div className="mt-4 text-blue-600 text-sm text-center font-medium">{statusMessage}</div>}

                        <button 
                            onClick={handlePayment} 
                            disabled={loading}
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
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
            `}</style>
        </div>,
        document.body
    );
};

export default CheckoutModal;
