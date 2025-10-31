import React from 'react';
import { Link } from 'react-router-dom';
import { IconCheck } from '@/components/Icons';

const PaymentSuccessPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 sm:p-12 bg-white rounded-lg shadow-xl max-w-lg mx-auto">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <IconCheck className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          Gracias por tu compra. Hemos recibido tu pago y tu pedido está siendo procesado. 
          Recibirás un correo electrónico con los detalles de tu compra y la información de seguimiento una vez que sea despachado.
        </p>
        <Link 
          to="/lista-publica" 
          className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-primary-dark transition-colors"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
