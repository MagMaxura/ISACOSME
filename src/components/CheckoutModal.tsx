import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { IconX, IconMercadoPago, IconAlertCircle, IconCheck, IconCashBanknote, IconTruck } from './Icons';
import { createVenta, VentaToCreate, prepareVentaItemsFromCart } from '../services/ventasService';
import { createPreference } from '../services/mercadoPagoService';
import { OrderItem } from '@/types';
import DatabaseErrorDisplay from './DatabaseErrorDisplay';

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
    placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ name, label, value, onChange, error, type = 'text', required = true, disabled = false, placeholder }) => (
    <div>
        <label className="label-style">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={value} 
            onChange={onChange} 
            required={required} 
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            className={`input-style ${error ? 'border-red-500' : ''} ${disabled ? 'bg-gray-100 text-gray-500' : ''}`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
);

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, orderItems, subtotal, shippingCost = 0 }) => {
    const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'transferencia'>('mercadopago');
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
    const [apiError, setApiError] = useState<any | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [orderFinished, setOrderFinished] = useState(false);

    // Cálculos de descuentos y totales
    const discountTransfer = useMemo(() => {
        return paymentMethod === 'transferencia' ? subtotal * 0.05 : 0;
    }, [paymentMethod, subtotal]);

    const total = subtotal - discountTransfer + shippingCost;

    if (!isOpen) return null;

    const validateField = (name: string, value: string) => {
        let error: string | null = null;
        if (!value.trim()) {
            error = 'Requerido.';
        } else {
            switch (name) {
                case 'dni':
                case 'phone':
                case 'zip_code':
                    if (!/^\d+$/.test(value)) error = 'Solo números.';
                    break;
                case 'email':
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Email inválido.';
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

    const getTiendaFromHostname = () => {
        const host = window.location.hostname;
        if (host.includes('ultrashineskin')) return 'Ultrashine';
        if (host.includes('bodytancaribbean')) return 'Bodytan';
        return 'Isabella';
    };
    
    const handleProcessOrder = async () => {
        let formIsValid = true;
        for (const key in payerInfo) {
            validateField(key, payerInfo[key as keyof typeof payerInfo]);
            if (!payerInfo[key as keyof typeof payerInfo]) formIsValid = false;
        }
        if (!formIsValid || Object.values(errors).some(e => e !== null)) {
            setApiError({ message: "Por favor, completa todos los campos correctamente." });
            return;
        }

        setLoading(true);
        setApiError(null);
        setStatusMessage('Reservando stock...');

        try {
            const itemsParaVenta = await prepareVentaItemsFromCart(orderItems);
            
            // FORMATEO DE NOTA CON TRUNCADO DE DECIMALES
            const shippingNote = shippingCost > 0 ? ` [Incluye Envío: $${shippingCost.toFixed(2)}]` : ' [Envío Gratis]';
            const discountNote = discountTransfer > 0 ? ` [Descuento Transferencia 5%: -$${discountTransfer.toFixed(2)}]` : '';
            const methodLabel = paymentMethod === 'mercadopago' ? 'WEB MP' : 'WEB TRANSFERENCIA';
            
            const direccionCompleta = `${payerInfo.street_name} ${payerInfo.street_number}, ${payerInfo.city}, ${payerInfo.province} (CP: ${payerInfo.zip_code})`;
            
            const saleData: VentaToCreate = {
                clienteId: null,
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'Venta',
                estado: 'Pendiente', 
                items: itemsParaVenta,
                subtotal: subtotal,
                iva: 0,
                total: total,
                observaciones: `${methodLabel}${shippingNote}${discountNote} - ${payerInfo.name} ${payerInfo.surname} (DNI: ${payerInfo.dni}) - Tel: ${payerInfo.phone} - Dirección: ${direccionCompleta}`,
                puntoDeVenta: 'Tienda física',
                tienda: getTiendaFromHostname(),
            };

            const newSaleId = await createVenta(saleData);
            
            if (paymentMethod === 'mercadopago') {
                setStatusMessage('Generando link de pago...');
                const initPoint = await createPreference(orderItems, payerInfo, newSaleId, shippingCost);
                window.location.href = initPoint;
            } else {
                // Flujo de transferencia
                setOrderFinished(true);
                setLoading(false);
            }

        } catch (err: any) {
            console.error("Checkout error:", err);
            setApiError(err);
            setLoading(false);
        }
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Pantalla de éxito para Transferencia
    if (orderFinished) {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center animate-fade-in">
                    <div className="mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                        <IconCheck className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">¡Pedido Recibido!</h3>
                    <p className="text-gray-600 mb-6">Hemos registrado tu pedido. Para completarlo, por favor realiza la transferencia a los datos que te enviaremos por WhatsApp.</p>
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left mb-6 space-y-2">
                        <p className="text-sm font-semibold text-gray-500 uppercase">Total a transferir:</p>
                        <p className="text-3xl font-bold text-primary">{formatPrice(total)}</p>
                    </div>

                    <button 
                        onClick={() => window.location.href = `https://wa.me/5493417192294?text=${encodeURIComponent(`Hola! Acabo de realizar un pedido por transferencia por un total de ${formatPrice(total)}. Mi nombre es ${payerInfo.name} ${payerInfo.surname}.`)}`}
                        className="w-full bg-[#25D366] hover:bg-[#1da851] text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-transform hover:scale-[1.02]"
                    >
                        Informar Pago por WhatsApp
                    </button>
                    <button onClick={onClose} className="mt-4 text-gray-400 hover:text-gray-600 text-sm font-medium">Volver a la tienda</button>
                </div>
            </div>,
            document.body
        );
    }

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">Checkout Seguro</h3>
                        <p className="text-sm text-gray-500">Tienda: {getTiendaFromHostname()}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors">
                        <IconX className="w-8 h-8" />
                    </button>
                </div>
                
                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                    <div className="lg:w-3/5 p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-8">
                            {/* Selector de Pago */}
                            <section>
                                <h4 className="text-md font-bold text-gray-700 mb-4 border-b pb-1">Selecciona cómo quieres pagar:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setPaymentMethod('mercadopago')}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'mercadopago' ? 'border-primary bg-violet-50 text-primary ring-4 ring-violet-100' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <IconMercadoPago className="w-8 h-8" />
                                        <div className="text-left">
                                            <p className="font-bold">Mercado Pago</p>
                                            <p className="text-xs opacity-70">Tarjetas, Débito o Saldo</p>
                                        </div>
                                    </button>
                                    <button 
                                        onClick={() => setPaymentMethod('transferencia')}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'transferencia' ? 'border-primary bg-violet-50 text-primary ring-4 ring-violet-100' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="bg-primary text-white p-1 rounded-lg">
                                            <IconCashBanknote className="w-6 h-6" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold">Transferencia</p>
                                            <p className="text-xs text-green-600 font-bold">¡5% de Descuento!</p>
                                        </div>
                                    </button>
                                </div>
                            </section>

                            <section>
                                <h4 className="text-md font-semibold text-primary mb-3 border-b pb-1">1. Datos de Contacto</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <InputField name="name" label="Nombre" value={payerInfo.name} onChange={handleInputChange} error={errors.name} disabled={loading} />
                                    <InputField name="surname" label="Apellido" value={payerInfo.surname} onChange={handleInputChange} error={errors.surname} disabled={loading} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <InputField name="email" label="Email" type="email" value={payerInfo.email} onChange={handleInputChange} error={errors.email} disabled={loading} />
                                    <InputField name="phone" label="Teléfono / WhatsApp" type="number" value={payerInfo.phone} onChange={handleInputChange} error={errors.phone} disabled={loading} />
                                </div>
                                <div className="mt-4">
                                    <InputField name="dni" label="DNI o CUIT (Titular)" type="number" value={payerInfo.dni} onChange={handleInputChange} error={errors.dni} disabled={loading} />
                                </div>
                            </section>

                            <section>
                                <h4 className="text-md font-semibold text-primary mb-3 border-b pb-1">2. Dirección de Envío</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <InputField name="street_name" label="Calle" value={payerInfo.street_name} onChange={handleInputChange} error={errors.street_name} disabled={loading} />
                                    </div>
                                    <div>
                                        <InputField name="street_number" label="Altura" type="number" value={payerInfo.street_number} onChange={handleInputChange} error={errors.street_number} disabled={loading} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <InputField name="city" label="Ciudad" value={payerInfo.city} onChange={handleInputChange} error={errors.city} disabled={loading} />
                                    <InputField name="province" label="Provincia" value={payerInfo.province} onChange={handleInputChange} error={errors.province} disabled={loading} />
                                </div>
                                <div className="mt-4">
                                    <InputField name="zip_code" label="Código Postal" type="number" value={payerInfo.zip_code} onChange={handleInputChange} error={errors.zip_code} disabled={loading} />
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="lg:w-2/5 bg-gray-50 border-l border-gray-200 p-6 flex flex-col justify-between overflow-y-auto">
                        <div className="flex flex-col flex-1">
                            <h4 className="text-lg font-bold text-gray-800 mb-4">Resumen de Compra</h4>
                            
                            <DatabaseErrorDisplay error={apiError} />

                            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200 max-h-48 overflow-y-auto custom-scrollbar">
                                {orderItems.map(item => (
                                    <div key={item.id} className="flex justify-between py-2 border-b last:border-0 border-gray-100 text-sm">
                                        <span className="font-medium text-gray-700">{item.quantity} x {item.nombre}</span>
                                        <span className="font-semibold text-gray-900">{formatPrice(item.lineTotal)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                                
                                {discountTransfer > 0 && (
                                    <div className="flex justify-between text-green-600 font-bold">
                                        <span>Descuento Transferencia (5%)</span>
                                        <span>-{formatPrice(discountTransfer)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-gray-600">
                                    <span>Envío</span>
                                    {shippingCost === 0 ? <span className="text-green-600 font-bold">Gratis</span> : <span>{formatPrice(shippingCost)}</span>}
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-gray-300">
                                    <span className="text-xl font-bold text-gray-800">Total</span>
                                    <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button 
                                onClick={handleProcessOrder} 
                                disabled={loading}
                                className={`w-full py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center gap-3 ${paymentMethod === 'mercadopago' ? 'bg-[#009EE3] text-white hover:bg-[#0089C7]' : 'bg-primary text-white hover:bg-primary-dark'}`}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        {statusMessage}
                                    </span>
                                ) : (
                                    <>
                                        {paymentMethod === 'mercadopago' ? (
                                            <><span>Pagar con Mercado Pago</span><IconMercadoPago className="w-6 h-6 text-white" /></>
                                        ) : (
                                            <><span>Finalizar por Transferencia</span><IconCheck className="w-6 h-6 text-white" /></>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
             <style>{`
                .label-style { display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #4B5563; }
                .input-style { display: block; width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.5rem; background-color: #F9FAFB; transition: all 0.2s; font-size: 0.95rem; } 
                .input-style:focus { outline: none; border-color: #8a5cf6; background-color: #fff; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}</style>
        </div>,
        document.body
    );
};

export default CheckoutModal;
