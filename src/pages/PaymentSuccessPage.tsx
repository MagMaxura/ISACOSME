
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconCheck, IconBrandWhatsapp, IconArrowLeft } from '@/components/Icons';

const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    // Mercado Pago returns:
    // collection_status=approved
    // payment_id=...
    // external_reference=... (This is our internal Sale ID)
    // merchant_order_id=...
    
    const extRef = searchParams.get('external_reference');
    const payId = searchParams.get('payment_id');
    
    if (extRef && extRef !== 'null') {
        setOrderId(extRef);
    }
    if (payId) {
        setPaymentId(payId);
    }
  }, [searchParams]);

  // --- Configuración de WhatsApp ---
  const whatsappNumber = '5493417192294'; // Tu número de administración
  
  // Construimos el mensaje
  const idShort = orderId ? orderId.substring(0, 8).toUpperCase() : 'WEB';
  let message = `👋 ¡Hola Isabella de la Perla! \n\n`;
  message += `✅ Acabo de realizar el pago de mi pedido.\n`;
  if (orderId) {
      message += `🆔 *ID de Orden:* ${idShort}\n`;
  }
  if (paymentId) {
      message += `💳 *Comprobante MP:* ${paymentId}\n`;
  }
  message += `\nPor favor, confirmen la recepción y el envío. ¡Gracias!`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        {/* Header Verde */}
        <div className="bg-green-500 p-8 text-center">
          <div className="mx-auto bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-4 animate-bounce">
            <IconCheck className="w-10 h-10 text-green-500" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">¡Pago Exitoso!</h1>
          <p className="text-green-100 mt-2 text-sm">Tu transacción fue procesada correctamente</p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          
          <div className="text-center">
            <p className="text-gray-600 leading-relaxed">
              Gracias por tu compra. Hemos registrado tu pedido en el sistema.
            </p>
            {orderId && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-200 inline-block">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Código de Pedido</p>
                    <p className="text-xl font-mono font-bold text-gray-800 select-all">{idShort}</p>
                </div>
            )}
          </div>

          {/* Action Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <h3 className="font-bold text-yellow-800 text-center mb-2">⚠️ Paso Final Requerido</h3>
            <p className="text-sm text-yellow-800 text-center mb-4">
              Para agilizar el armado y envío, por favor envíanos el comprobante por WhatsApp ahora mismo.
            </p>
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all transform hover:scale-105 group"
            >
              <IconBrandWhatsapp className="w-6 h-6 mr-3 group-hover:animate-pulse" />
              Enviar Comprobante
            </a>
          </div>

          <div className="border-t border-gray-100 pt-6 text-center">
            <Link 
              to="/lista-publica" 
              className="inline-flex items-center text-gray-500 hover:text-primary font-medium transition-colors"
            >
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-400">Isabella de la Perla &copy; {new Date().getFullYear()}</p>
    </div>
  );
};

export default PaymentSuccessPage;
