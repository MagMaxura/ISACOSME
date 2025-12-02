
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { IconX, IconCheck, IconDeviceFloppy, IconAlertCircle } from './Icons';
import { createVenta, VentaToCreate, prepareVentaItemsFromCart } from '../services/ventasService';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { supabase } from '@/supabase';

// Intentar obtener la clave desde las variables de entorno
// Usamos cast a 'any' para evitar error de TypeScript 'Property env does not exist on type ImportMeta'
const MP_PUBLIC_KEY = (import.meta as any).env.VITE_MP_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

// Inicializar solo si tenemos una clave que parece válida (evita crash inmediato)
if (MP_PUBLIC_KEY && MP_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-AR' });
}

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
    const [step, setStep] = useState<'form' | 'payment_brick'>('form');
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    
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

    useEffect(() => {
        if (step === 'payment_brick' && MP_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
            setConfigError('La Public Key de Mercado Pago no está configurada. Por favor, configura la variable de entorno VITE_MP_PUBLIC_KEY.');
        }
    }, [step]);

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
    
    // Step 1: Save Order to Database
    const handleRegisterOrder = async () => {
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
        setStatusMessage('Registrando tu pedido en el sistema...');

        try {
            const itemsParaVenta = await prepareVentaItemsFromCart(orderItems);
            const shippingNote = shippingCost > 0 ? ` [Incluye Envío: $${shippingCost}]` : ' [Envío Gratis]';
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
                observaciones: `Compra Web${shippingNote} - Cliente: ${payerInfo.name} ${payerInfo.surname} (DNI: ${payerInfo.dni}) - Tel: ${payerInfo.phone} - Envío a: ${direccionCompleta}`,
                puntoDeVenta: 'Tienda física', 
            };

            const newSaleId = await createVenta(saleData);
            setCreatedOrderId(newSaleId);
            setStatusMessage('');
            setStep('payment_brick'); // Go to Payment Brick

        } catch (err: any) {
            console.error("Order registration error:", err);
            let msg = err.message || 'Ocurrió un error al registrar el pedido.';
            if (msg.includes('insufficient stock')) msg = 'Stock insuficiente para completar el pedido.';
            setApiError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Brick onSubmit Handler
    const handleBrickSubmit = async (param: any) => {
        const { formData } = param;
        console.log("Brick onSubmit triggered. Sending data to backend...");
        
        return new Promise<void>((resolve, reject) => {
            supabase.functions.invoke('mercadopago-process-payment', {
                body: { 
                    formData, 
                    external_reference: createdOrderId 
                }
            })
            .then(({ data, error }) => {
                if (error) {
                    console.error("Function Invocation Error:", error);
                    reject();
                } else if (data && data.status === 'approved') {
                    console.log("Payment approved:", data);
                    resolve();
                    // Redirect to success page
                    window.location.href = `/#/payment-success?external_reference=${createdOrderId}&payment_id=${data.id}`;
                } else {
                    console.error("Payment Not Approved. Response:", data);
                    // reject() tells the Brick to show the error screen
                    reject(); 
                }
            })
            .catch((err) => {
                console.error("Network/System Error during payment:", err);
                reject();
            });
        });
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-2xl font-semibold text-gray-800">
                        {step === 'form' ? 'Finalizar Compra' : 'Realizar Pago'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex flex-col lg:flex-row p-6 gap-8 overflow-y-auto">
                    {/* Left Column: Form or Brick */}
                    <div className="lg:w-3/5 space-y-4">
                        {step === 'form' ? (
                            <>
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
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <InputField name="city" label="Ciudad / Localidad" value={payerInfo.city} onChange={handleInputChange} error={errors.city} />
                                    <InputField name="province" label="Provincia" value={payerInfo.province} onChange={handleInputChange} error={errors.province} />
                                </div>
                                
                                <InputField name="zip_code" label="Código Postal" value={payerInfo.zip_code} onChange={handleInputChange} error={errors.zip_code} />
                            </>
                        ) : (
                            <div className="w-full">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-center">
                                    <div className="flex items-center justify-center gap-2 text-green-800 font-bold">
                                        <IconCheck className="w-5 h-5" />
                                        <span>Pedido Registrado</span>
                                    </div>
                                    <p className="text-xs text-green-700">Orden #{createdOrderId?.substring(0, 8).toUpperCase()}. Completa el pago abajo.</p>
                                </div>
                                
                                {configError ? (
                                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                                        <IconAlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-red-800">Error de Configuración</h4>
                                            <p className="text-sm text-red-700">{configError}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <Payment
                                        initialization={{
                                            amount: total,
                                            payer: {
                                                firstName: payerInfo.name,
                                                lastName: payerInfo.surname,
                                                email: payerInfo.email,
                                                identification: {
                                                    type: "DNI",
                                                    number: payerInfo.dni
                                                },
                                                address: {
                                                    zipCode: payerInfo.zip_code,
                                                    federalUnit: payerInfo.province,
                                                    city: payerInfo.city,
                                                    streetName: payerInfo.street_name,
                                                    streetNumber: payerInfo.street_number,
                                                    neighborhood: "",
                                                    complement: ""
                                                }
                                            },
                                        }}
                                        customization={{
                                            visual: {
                                                style: {
                                                    theme: "default",
                                                    customVariables: {
                                                        textPrimaryColor: "#1e293b",
                                                        textSecondaryColor: "#64748b",
                                                        inputBackgroundColor: "#ffffff",
                                                        formBackgroundColor: "#ffffff",
                                                        baseColor: "#8a5cf6",
                                                        baseColorFirstVariant: "#7c3aed",
                                                        baseColorSecondVariant: "#a78bfa",
                                                        errorColor: "#ef4444",
                                                        successColor: "#22c55e",
                                                        outlinePrimaryColor: "#8a5cf6",
                                                        outlineSecondaryColor: "#e2e8f0",
                                                        buttonTextColor: "#ffffff",
                                                        fontSizeExtraSmall: "12px",
                                                        fontSizeSmall: "14px",
                                                        fontSizeMedium: "16px",
                                                        fontSizeLarge: "18px",
                                                        fontSizeExtraLarge: "20px",
                                                        fontWeightNormal: "400",
                                                        fontWeightSemiBold: "600",
                                                        formInputsTextTransform: "none",
                                                        inputVerticalPadding: "12px",
                                                        inputHorizontalPadding: "16px",
                                                        inputFocusedBoxShadow: "0 0 0 2px #ddd6fe",
                                                        inputErrorFocusedBoxShadow: "0 0 0 2px #fecaca",
                                                        inputBorderWidth: "1px",
                                                        inputFocusedBorderWidth: "1px",
                                                        borderRadiusSmall: "4px",
                                                        borderRadiusMedium: "6px",
                                                        borderRadiusLarge: "8px",
                                                        borderRadiusFull: "9999px",
                                                        formPadding: "24px"
                                                    }
                                                },
                                                texts: {
                                                    formTitle: "Finalizar pago",
                                                    emailSectionTitle: "Ingresa tu email para el comprobante",
                                                    installmentsSectionTitle: "Elige la cantidad de cuotas",
                                                    formSubmit: "Pagar ahora",
                                                    paymentMethods: {
                                                        creditCardTitle: "Tarjeta de Crédito",
                                                        debitCardTitle: "Tarjeta de Débito",
                                                        ticketTitle: "Efectivo",
                                                    }
                                                }
                                            },
                                            paymentMethods: {
                                                maxInstallments: 12,
                                                paymentMethod: {
                                                    types: {
                                                        excluded: []
                                                    }
                                                }
                                            }
                                        }}
                                        onSubmit={handleBrickSubmit}
                                        onError={(error) => console.error("Brick Error:", error)}
                                        onReady={() => console.log("Brick Ready")}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Order Summary */}
                    <div className="lg:w-2/5 bg-gray-50 p-6 rounded-lg h-fit flex flex-col">
                        <h4 className="text-lg font-semibold text-gray-700 mb-4">Resumen del Pedido</h4>
                         <div className="space-y-3 max-h-60 overflow-y-auto pr-2 flex-grow">
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
                        <div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-2">
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
                            <div className="flex justify-between font-bold text-xl text-gray-800 border-t pt-2">
                                <span>Total:</span>
                                <span>{formatPrice(total)}</span>
                            </div>
                        </div>
                        
                        {apiError && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-md text-sm">{apiError}</div>}
                        {loading && statusMessage && (
                            <div className="mt-4 flex items-center justify-center text-blue-600 text-sm font-medium bg-blue-50 p-2 rounded">
                                {statusMessage}
                            </div>
                        )}

                        {step === 'form' && (
                            <button 
                                onClick={handleRegisterOrder} 
                                disabled={loading}
                                className="w-full mt-6 bg-primary text-white py-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center"
                            >
                                <IconDeviceFloppy className="h-6 w-6 mr-2" />
                                Confirmar y Continuar
                            </button>
                        )}
                    </div>
                </div>
            </div>
             <style>{`
                .label-style { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; color: #374151; }
                .input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: border-color 0.15s ease-in-out; } 
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
