import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconCheck, IconBrandWhatsapp, IconArrowLeft, IconPackage } from '@/components/Icons';

const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    // Mercado Pago returns these params on redirection
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
  // Este es el número al que le llegarán los comprobantes
  const whatsappNumber = '5493417192294'; 
  
  // Construimos el mensaje predeterminado
  const idShort = orderId ? orderId.substring(0, 8).toUpperCase() : 'WEB';
  
  let message = `👋 *¡Hola Isabella de la Perla!* \n\n`;
  message += `✅ Ya realicé el pago de mi pedido.\n\n`;
  if (orderId) {
      message += `🆔 *Código de Pedido:* ${idShort}\n`;
  }
  if (paymentId) {
      message += `💳 *Comprobante MP:* ${paymentId}\n`;
  } else {
      message += `💳 *Pago:* Aprobado\n`;
  }
  message += `\nAguardo confirmación para el envío. ¡Gracias!`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        {/* Header Verde */}
        <div className="bg-[#00C851] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white opacity-10 transform rotate-45 translate-y-1/2"></div>
          <div className="relative z-10">
            <div className="mx-auto bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-4 animate-bounce">
                <IconCheck className="w-10 h-10 text-[#00C851]" strokeWidth={4} />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-wide drop-shadow-md">¡Pago Exitoso!</h1>
            <p className="text-green-50 mt-2 font-medium">Tu pedido ha sido registrado.</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8">
          
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-sm uppercase tracking-wide font-semibold">Código de Referencia</p>
            <div className="inline-block bg-gray-100 px-6 py-3 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-3xl font-mono font-bold text-gray-800 tracking-wider select-all">
                    {idShort}
                </p>
            </div>
            <p className="text-xs text-gray-400">Guarda este código para tu seguimiento</p>
          </div>

          {/* Action Box - WhatsApp */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-inner">
            <div className="flex items-center justify-center mb-3 text-yellow-700 font-bold">
                <IconPackage className="w-5 h-5 mr-2" />
                <span>Paso Final Requerido</span>
            </div>
            <p className="text-sm text-yellow-800 text-center mb-5 leading-relaxed">
              Para agilizar el armado y despacho inmediato de tu caja, por favor avísanos por WhatsApp ahora mismo.
            </p>
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-[#25D366] hover:bg-[#20b358] text-white font-bold text-lg py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 group"
            >
              <IconBrandWhatsapp className="w-8 h-8 mr-3 group-hover:animate-pulse" />
              Enviar Comprobante
            </a>
          </div>

          <div className="border-t border-gray-100 pt-6 text-center">
            <Link 
              to="/lista-publica" 
              className="inline-flex items-center text-gray-400 hover:text-primary font-medium transition-colors text-sm"
            >
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-gray-400 opacity-70">Sistema ERP &copy; {new Date().getFullYear()}</p>
    </div>
  );
};

export default PaymentSuccessPage;