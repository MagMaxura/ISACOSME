import React, { useState } from 'react';
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPayerInfo(prev => ({ ...prev, [name]: value }));
    };
    
    const handlePayment = async () => {
        setLoading(true);
        setError(null);
        try {
            const preferenceInitPoint = await createPreference(orderItems, payerInfo);
            window.location.href = preferenceInitPoint;
        } catch (err: any) {
            setError(err.message || 'No se pudo iniciar el proceso de pago.');
            setLoading(false);
        }
    };
    
    const formatPrice = (price: number) => `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                            <div>
                                <label className="label-style">Nombre</label>
                                <input type="text" name="name" value={payerInfo.name} onChange={handleInputChange} required className="input-style" />
                            </div>
                            <div>
                                <label className="label-style">Apellido</label>
                                <input type="text" name="surname" value={payerInfo.surname} onChange={handleInputChange} required className="input-style" />
                            </div>
                        </div>
                        <div>
                            <label className="label-style">Email</label>
                            <input type="email" name="email" value={payerInfo.email} onChange={handleInputChange} required className="input-style" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label-style">Teléfono</label>
                                <input type="tel" name="phone" value={payerInfo.phone} onChange={handleInputChange} required className="input-style" />
                            </div>
                            <div>
                                <label className="label-style">DNI/CUIT</label>
                                <input type="text" name="dni" value={payerInfo.dni} onChange={handleInputChange} required className="input-style" />
                            </div>
                        </div>

                        <h4 className="text-lg font-semibold text-gray-700 pt-4">Dirección de Envío</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label className="label-style">Calle</label>
                                <input type="text" name="street_name" value={payerInfo.street_name} onChange={handleInputChange} required className="input-style" />
                            </div>
                            <div>
                                <label className="label-style">Número</label>
                                <input type="text" name="street_number" value={payerInfo.street_number} onChange={handleInputChange} required className="input-style" />
                            </div>
                        </div>
                         <div>
                            <label className="label-style">Código Postal</label>
                            <input type="text" name="zip_code" value={payerInfo.zip_code} onChange={handleInputChange} required className="input-style" />
                        </div>
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
                        {error && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-md text-sm">{error}</div>}
                        <button 
                            onClick={handlePayment} 
                            disabled={loading}
                            className="w-full mt-6 bg-[#009EE3] text-white py-3 rounded-lg shadow-md hover:bg-[#0089c7] transition-colors disabled:bg-gray-400 font-semibold text-lg flex items-center justify-center"
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
            `}</style>
        </div>
    );
};

export default CheckoutModal;
