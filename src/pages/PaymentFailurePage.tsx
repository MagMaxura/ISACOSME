import React from 'react';
import { Link } from 'react-router-dom';
import { IconAlertCircle } from '@/components/Icons';

const PaymentFailurePage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 sm:p-12 bg-white rounded-lg shadow-xl max-w-lg mx-auto">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <IconAlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">Hubo un Problema con el Pago</h2>
        <p className="text-gray-600 mb-6">
          Lamentablemente, no pudimos procesar tu pago. Esto puede deberse a un error, a que cancelaste la operación o a que los fondos eran insuficientes.
        </p>
        <p className="text-gray-600 mb-6">
          No se ha realizado ningún cargo en tu cuenta. Por favor, intenta nuevamente.
        </p>
        <Link 
          to="/lista-publica" 
          className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-primary-dark transition-colors"
        >
          Volver a la tienda e intentar de nuevo
        </Link>
      </div>
    </div>
  );
};

export default PaymentFailurePage;
