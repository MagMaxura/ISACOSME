
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconCheck, IconBrandWhatsapp, IconArrowLeft, IconClock, IconFileText, IconPackage } from '@/components/Icons';
import { fetchVentaPorId } from '@/services/ventasService';
import { Venta } from '@/types';

const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('approved');
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  
  // Nuevo estado para los detalles de la compra
  const [saleDetails, setSaleDetails] = useState<Venta | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    // 1. Intentar obtener params del hook useSearchParams (funciona si están después del hash)
    let extRef = searchParams.get('external_reference');
    let payId = searchParams.get('payment_id');
    let statusParam = searchParams.get('status');
    let collectionStatus = searchParams.get('collection_status');
    let ticketUrlParam = searchParams.get('ticket_url');

    // 2. Si no están en el hash, buscar en window.location.search (query params reales antes del hash)
    // Mercado Pago a veces redirige a: dominio.com/?collection_id=...#/payment-success
    if (!extRef && !payId) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('external_reference')) extRef = urlParams.get('external_reference');
        if (urlParams.has('payment_id')) payId = urlParams.get('payment_id');
        if (urlParams.has('status')) statusParam = urlParams.get('status');
        if (urlParams.has('collection_status')) collectionStatus = urlParams.get('collection_status');
    }
    
    if (extRef && extRef !== 'null') setOrderId(extRef);
    if (payId) setPaymentId(payId);
    if (ticketUrlParam && ticketUrlParam !== 'undefined') setTicketUrl(ticketUrlParam);

    if (statusParam) {
        setStatus(statusParam);
    } else if (collectionStatus) {
        setStatus(collectionStatus === 'approved' ? 'approved' : 'in_process');
    }
  }, [searchParams]);

  // Fetch de los detalles de la venta cuando tenemos el orderId
  useEffect(() => {
      if (orderId && orderId !== 'NO_ID') {
          const fetchSaleDetails = async () => {
              setLoadingDetails(true);
              try {
                  const venta = await fetchVentaPorId(orderId);
                  if (venta) {
                      setSaleDetails(venta);
                  }
              } catch (error) {
                  console.error("Error fetching sale details:", error);
                  // No mostramos error en UI para no asustar al cliente, simplemente no se mostrará el detalle
              } finally {
                  setLoadingDetails(false);
              }
          };
          fetchSaleDetails();
      }
  }, [orderId]);

  const isPending = status === 'in_process' || status === 'pending';
  const whatsappNumber = '5493417192294';
  
  const idShort = orderId ? orderId.substring(0, 8).toUpperCase() : 'WEB';
  
  // Construcción del mensaje de WhatsApp
  let message = `👋 ¡Hola Isabella de la Perla! \n\n`;
  
  if (isPending) {
      message += ticketUrl 
        ? `🎟️ He generado un cupón de pago para mi pedido.\n` 
        : `⏳ He realizado un pago que quedó en *Revisión*.\n`;
  } else {
      message += `✨ ¡Estoy feliz! Ya realicé el pago de mi compra.\n`;
  }
  
  if (orderId) message += `🆔 *Pedido:* ${idShort}\n`;
  if (paymentId) message += `💳 *Pago MP:* ${paymentId}\n`;

  if (saleDetails && saleDetails.items.length > 0) {
      message += `\n📦 *Resumen:*\n`;
      saleDetails.items.forEach(item => {
          message += `• ${item.cantidad}x ${item.productoNombre}\n`;
      });
      message += `\n💰 *Total:* $${saleDetails.total.toLocaleString('es-AR')}\n`;
  }
  
  message += isPending 
    ? `\n¿Me podrían avisar cuando se acredite? Gracias.` 
    : `\nQuedo a la espera de la confirmación de envío. ¡Muchas gracias!`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header Dinámico */}
        <div className={`p-8 text-center relative overflow-hidden ${isPending ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gradient-to-br from-green-400 to-teal-600'}`}>
          <div className="absolute top-0 left-0 w-full h-full bg-white opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="relative z-10">
            <div className="mx-auto bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-4 animate-[bounce_1s_infinite]">
                {isPending ? (
                    <IconClock className="w-10 h-10 text-yellow-500" strokeWidth={3} />
                ) : (
                    <IconCheck className="w-10 h-10 text-green-500" strokeWidth={3} />
                )}
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-wide drop-shadow-md">
                {isPending 
                    ? (ticketUrl ? 'Cupón Generado' : 'Pago en Proceso') 
                    : '¡Felicitaciones!'
                }
            </h1>
            <p className="text-white text-opacity-90 mt-2 text-sm font-medium">
                {isPending 
                    ? 'Tu pedido está reservado a la espera del pago' 
                    : 'Tu compra ha sido confirmada con éxito'
                }
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Resumen de Compra (Ticket) */}
          {!isPending && saleDetails && (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-inner animate-fade-in-up">
                  <h3 className="text-gray-800 font-bold mb-3 flex items-center">
                      <IconPackage className="w-5 h-5 mr-2 text-primary" />
                      Resumen del Pedido
                  </h3>
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {saleDetails.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm text-gray-600">
                              <span className="truncate pr-4">{item.cantidad} x {item.productoNombre}</span>
                              <span className="font-medium whitespace-nowrap">${(item.cantidad * item.precioUnitario).toLocaleString('es-AR')}</span>
                          </div>
                      ))}
                  </div>
                  <div className="border-t border-gray-300 pt-3 flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Total Pagado</span>
                      <span className="text-xl font-bold text-gray-900">${saleDetails.total.toLocaleString('es-AR')}</span>
                  </div>
                  {orderId && (
                    <div className="mt-3 text-center">
                        <span className="bg-white px-3 py-1 rounded-full text-xs font-mono text-gray-500 border border-gray-200">
                            ID: {idShort}
                        </span>
                    </div>
                  )}
              </div>
          )}
          
          {!isPending && !saleDetails && loadingDetails && (
              <div className="text-center text-gray-500 py-4">Cargando detalles de tu compra...</div>
          )}

          {/* Ticket Button (Rapipago/PagoFacil) */}
          {ticketUrl && (
              <div className="text-center">
                  <a 
                    href={ticketUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
                  >
                      <IconFileText className="w-5 h-5 mr-2" />
                      Descargar Cupón de Pago
                  </a>
                  <p className="text-xs text-gray-500 mt-2">Es necesario para pagar en sucursal</p>
              </div>
          )}

          {/* Action Box */}
          <div className="text-center space-y-4">
            <p className="text-gray-600 text-sm">
                {isPending 
                    ? "Avísanos cuando hayas realizado el pago para reservar tu stock."
                    : "Para coordinar el envío y ultimar detalles, envíanos un mensaje."
                }
            </p>
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] group"
            >
              <IconBrandWhatsapp className="w-6 h-6 mr-2 group-hover:animate-pulse" />
              {isPending ? 'Notificar Pago' : 'Contactar por WhatsApp'}
            </a>
          </div>

          <div className="border-t border-gray-100 pt-6 text-center">
            <Link 
              to="/lista-publica" 
              className="inline-flex items-center text-gray-400 hover:text-primary font-medium transition-colors text-sm"
            >
              <IconArrowLeft className="w-4 h-4 mr-1" />
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-400">Isabella de la Perla &copy; {new Date().getFullYear()}</p>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
      `}</style>
    </div>
  );
};

export default PaymentSuccessPage;
