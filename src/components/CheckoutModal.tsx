
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { IconX, IconMercadoPago, IconAlertCircle, IconCheck } from './Icons';
import { createVenta, VentaToCreate, prepareVentaItemsFromCart } from '../services/ventasService';
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
  shippingCost?: number;
}

interface InputFieldProps {
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string | null;
    type?: string;
    required?: boolean;
    disabled?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ name, label, value, onChange, error, type = 'text', required = true, disabled = false }) => (
    <div>
        <label className="label-style">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={value} 
            onChange={onChange} 
            required={required} 
            disabled={disabled}
            autoComplete="off"
            className={`input-style ${error ? 'border-red-500' : ''} ${disabled ? 'bg-gray-100 text-gray-500' : ''}`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
);

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, orderItems, subtotal, shippingCost = 0 }) => {
    const [payerInfo, setPayerInfo] = useState({
        name: '',
        surname: '',
        email: '',
        phone: '',
        dni: '',
        street_name: '',
        street_number: '',
        zip_code: '',
        city: '',
        province: '',
    });
    const [errors, setErrors] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const total = subtotal + shippingCost;

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
    
    const handleCheckoutPro = async () => {
        // 1. Validar Formulario
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
        setStatusMessage('Registrando pedido...');

        try {
            // 2. Preparar Items y Stock
            const itemsParaVenta = await prepareVentaItemsFromCart(orderItems);
            const shippingNote = shippingCost > 0 ? ` [Incluye Envío: $${shippingCost}]` : ' [Envío Gratis]';
            const direccionCompleta = `${payerInfo.street_name} ${payerInfo.street_number}, ${payerInfo.city}, ${payerInfo.province} (CP: ${payerInfo.zip_code})`;
            
            // 3. Crear Venta en Base de Datos
            const saleData: VentaToCreate = {
                clienteId: null,
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'Venta',
                estado: 'Pendiente', // Se actualizará via Webhook cuando MP confirme
                items: itemsParaVenta,
                subtotal: subtotal,
                iva: 0,
                total: total,
                observaciones: `Checkout Pro${shippingNote} - Cliente: ${payerInfo.name} ${payerInfo.surname} (DNI: ${payerInfo.dni}) - Tel: ${payerInfo.phone} - Envío a: ${direccionCompleta}`,
                puntoDeVenta: 'Tienda física', 
            };

            const newSaleId = await createVenta(saleData);
            
            // 4. Crear Preferencia de Mercado Pago
            setStatusMessage('Generando link de pago seguro...');
            const initPoint = await createPreference(orderItems, payerInfo, newSaleId, shippingCost);
            
            // 5. Redirigir a Mercado Pago
            setStatusMessage('Redirigiendo a Mercado Pago...');
            window.location.href = initPoint;

        } catch (err: any) {
            console.error("Checkout error:", err);
            let msg = err.message || 'Ocurrió un error al procesar el pedido.';
            if (msg.includes('insufficient stock')) msg = 'Stock insuficiente para completar el pedido.';
            setApiError(msg);
            setLoading(false);
        }
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <IconMercadoPago className="w-8 h-8 mr-2 text-[#009EE3]" />
                        Finalizar Compra
                    </h3>
                    <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex flex-col lg:flex-row p-6 gap-8 overflow-y-auto">
                    {/* Left Column: Form */}
                    <div className="lg:w-3/5 space-y-4">
                        <h4 className="text-lg font-semibold text-gray-700">1. Datos del Cliente</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="name" label="Nombre" value={payerInfo.name} onChange={handleInputChange} error={errors.name} disabled={loading} />
                            <InputField name="surname" label="Apellido" value={payerInfo.surname} onChange={handleInputChange} error={errors.surname} disabled={loading} />
                        </div>
                        <InputField name="email" label="Email" type="email" value={payerInfo.email} onChange={handleInputChange} error={errors.email} disabled={loading} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="phone" label="Teléfono" type="number" value={payerInfo.phone} onChange={handleInputChange} error={errors.phone} disabled={loading} />
                            <InputField name="dni" label="DNI/CUIT" type="number" value={payerInfo.dni} onChange={handleInputChange} error={errors.dni} disabled={loading} />
                        </div>

                        <h4 className="text-lg font-semibold text-gray-700 pt-4">2. Dirección de Envío</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <InputField name="street_name" label="Calle" value={payerInfo.street_name} onChange={handleInputChange} error={errors.street_name} disabled={loading} />
                            </div>
                            <div>
                                <InputField name="street_number" label="Número" type="number" value={payerInfo.street_number} onChange={handleInputChange} error={errors.street_number} disabled={loading} />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField name="city" label="Ciudad / Localidad" value={payerInfo.city} onChange={handleInputChange} error={errors.city} disabled={loading} />
                            <InputField name="province" label="Provincia" value={payerInfo.province} onChange={handleInputChange} error={errors.province} disabled={loading} />
                        </div>
                        
                        <InputField name="zip_code" label="Código Postal" type="number" value={payerInfo.zip_code} onChange={handleInputChange} error={errors.zip_code} disabled={loading} />
                    </div>

                    {/* Right Column: Order Summary & Pay Button */}
                    <div className="lg:w-2/5 flex flex-col">
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm sticky top-0">
                            <h4 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Resumen del Pedido</h4>
                            
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-4">
                                {orderItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-start text-sm">
                                        <div>
                                            <p className="font-medium text-gray-800">{item.nombre}</p>
                                            <p className="text-gray-500 text-xs">{item.quantity} x {formatPrice(item.unitPrice)}</p>
                                        </div>
                                        <p className="font-semibold text-gray-700">{formatPrice(item.lineTotal)}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 border-t border-gray-200 pt-4">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal:</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Costo de Envío:</span>
                                    {shippingCost === 0 ? (
                                        <span className="text-green-600 font-bold">Gratis</span>
                                    ) : (
                                        <span>{formatPrice(shippingCost)}</span>
                                    )}
                                </div>
                                <div className="flex justify-between font-bold text-2xl text-gray-900 pt-2 border-t border-gray-200 mt-2">
                                    <span>Total:</span>
                                    <span>{formatPrice(total)}</span>
                                </div>
                            </div>

                            {apiError && (
                                <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm flex items-start">
                                    <IconAlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Error</p>
                                        <p>{apiError}</p>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleCheckoutPro} 
                                disabled={loading}
                                className="w-full mt-6 bg-[#009EE3] hover:bg-[#0089C7] text-white py-4 rounded-lg shadow-md transition-all transform hover:scale-[1.02] active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center relative overflow-hidden"
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Procesando...
                                    </span>
                                ) : (
                                    <>
                                        Pagar con Mercado Pago
                                        <IconMercadoPago className="w-6 h-6 ml-2" />
                                    </>
                                )}
                            </button>
                            
                            {loading && statusMessage && (
                                <p className="text-center text-sm text-[#009EE3] mt-3 font-medium animate-pulse">
                                    {statusMessage}
                                </p>
                            )}

                            {!loading && (
                                <p className="text-xs text-center text-gray-500 mt-4">
                                    Serás redirigido al sitio seguro de Mercado Pago para completar tu compra. Aceptamos tarjetas, efectivo (Rapipago/PagoFácil) y dinero en cuenta.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
             <style>{`
                .label-style { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; color: #374151; }
                .input-style { display: block; width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: all 0.2s; } 
                .input-style:focus { outline: none; border-color: #8a5cf6; ring: 2px; ring-color: #ddd6fe; }
                .input-style.border-red-500 { border-color: #EF4444; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                @keyframes fade-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.25s ease-out; }
            `}</style>
        </div>,
        document.body
    );
};

export default CheckoutModal;
