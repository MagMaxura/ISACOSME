import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconCheck, IconBrandWhatsapp } from '@/components/Icons';

const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // --- Integración con WhatsApp ---
  const whatsappNumber = '5493417192294'; 

  // Obtenemos los detalles del pago desde la URL para dar contexto
  const paymentId = searchParams.get('payment_id');
  const merchantOrderId = searchParams.get('merchant_order_id');

  // Creamos el mensaje pre-cargado
  const baseMessage = `¡Hola! Acabo de completar mi compra en Isabella de la Perla. Quería avisar para que gestionen mi paquete.`;
  const orderDetails = paymentId ? ` Mi número de pago es ${paymentId}.` : merchantOrderId ? ` Mi ID de orden es ${merchantOrderId}.` : '';
  const fullMessage = baseMessage + orderDetails;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(fullMessage)}`;
  // --- Fin de la integración ---

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 sm:p-12 bg-white rounded-lg shadow-xl max-w-lg mx-auto">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <IconCheck className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          ¡Gracias por tu compra! Tu pago ha sido procesado correctamente.
        </p>

        {/* Nueva sección de contacto */}
        <div className="mt-8 pt-6 border-t border-gray-200 bg-yellow-50 p-6 rounded-lg">
          <p className="text-gray-800 font-semibold mb-4">¡Paso final e importante!</p>
          <p className="text-gray-700 mb-4">
            Para agilizar el armado de tu paquete, por favor envíanos un mensaje por WhatsApp con la información de tu pago completado. Así, daremos aviso para que se gestione tu envío a la brevedad.
          </p>
          <a 
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-green-500 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-green-600 transition-colors w-full sm:w-auto"
          >
            <IconBrandWhatsapp className="h-6 w-6 mr-2" />
            Avisar por WhatsApp
          </a>
        </div>

        <Link 
          to="/lista-publica" 
          className="inline-block mt-8 text-sm text-gray-600 hover:text-primary transition-colors"
        >
          o Volver a la tienda
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
