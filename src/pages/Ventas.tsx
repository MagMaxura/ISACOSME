
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Venta } from '@/types';
import { IconPlus, IconTrash, IconBrandWhatsapp, IconEye, IconX, IconPackage, IconTruck, IconClock } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVentas as fetchVentasService, updateVentaStatus, deleteVenta } from '@/services/ventasService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

// Helper to extract structured data from observations for WEB sales
const extractWebInfo = (obs: string) => {
    if (!obs || !obs.startsWith('WEB MP')) return null;
    const info: any = {};
    const nameMatch = obs.match(/ - (.*?) \(DNI/);
    if (nameMatch) info.nombre = nameMatch[1];
    const dniMatch = obs.match(/\(DNI:\s*(\d+)\)/);
    if (dniMatch) info.dni = dniMatch[1];
    const telMatch = obs.match(/Tel:\s*(\d+)/);
    if (telMatch) info.telefono = telMatch[1];
    const addrMatch = obs.match(/Dirección:\s*(.*)/);
    if (addrMatch) info.direccionCompleta = addrMatch[1];
    const shipMatch = obs.match(/\[(.*?)\]/);
    if (shipMatch) info.envioStatus = shipMatch[1];
    return info;
};

// --- Expanded Detail Row Component ---
const VentaDetailContent: React.FC<{ venta: any }> = ({ venta }) => {
    const webInfo = extractWebInfo(venta.observaciones || '');
    const formatPrice = (p: number) => `$${p.toLocaleString('es-AR')}`;

    return (
        <div className="bg-gray-50 border-x-2 border-b-2 border-violet-100 p-6 space-y-6 animate-fade-in-down rounded-b-lg shadow-inner">
            {/* Customer & Shipping Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Información del Cliente</h4>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-1">
                        <p className="font-bold text-gray-800">{webInfo?.nombre || venta.clienteNombre}</p>
                        {webInfo?.dni && <p className="text-sm text-gray-600">DNI: {webInfo.dni}</p>}
                        <p className="text-sm text-gray-600">Tel: {webInfo?.telefono || venta.clienteTelefono || 'N/A'}</p>
                        {venta.puntoDeVenta && <p className="text-[10px] font-semibold text-primary mt-2 uppercase">Origen: {venta.puntoDeVenta}</p>}
                    </div>
                </div>
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos de Entrega</h4>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex items-start">
                        <IconTruck className="w-5 h-5 mr-3 text-primary mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-gray-800 leading-tight">
                                {webInfo?.direccionCompleta || 'Entrega en tienda / Manual'}
                            </p>
                            {webInfo?.envioStatus && (
                                <p className="text-[10px] bg-violet-50 border border-violet-100 text-primary px-2 py-0.5 rounded-full mt-2 inline-block font-bold">
                                    {webInfo.envioStatus}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Section */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                    <IconPackage className="w-4 h-4 mr-2" />
                    Productos Solicitados
                </h4>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr className="text-left text-gray-500">
                                <th className="p-3">Producto</th>
                                <th className="p-3 text-center">Cant.</th>
                                <th className="p-3 text-right">Precio</th>
                                <th className="p-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {venta.items.map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="p-3 font-medium text-gray-700">{item.productoNombre}</td>
                                    <td className="p-3 text-center text-gray-600">{item.cantidad}</td>
                                    <td className="p-3 text-right text-gray-600">{formatPrice(item.precioUnitario)}</td>
                                    <td className="p-3 text-right font-semibold text-gray-800">{formatPrice(item.cantidad * item.precioUnitario)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t">
                            <tr>
                                <td colSpan={3} className="p-3 text-right text-gray-500 uppercase text-xs">TOTAL PEDIDO</td>
                                <td className="p-3 text-right text-lg text-primary">{formatPrice(venta.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Manual Observations */}
            {(!webInfo && venta.observaciones) && (
                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                    <h4 className="text-xs font-bold text-yellow-700 uppercase mb-1">Notas del Pedido</h4>
                    <p className="text-sm text-yellow-800 italic">{venta.observaciones}</p>
                </div>
            )}
        </div>
    );
};

const Ventas: React.FC = () => {
    const { profile } = useAuth();
    const [ventas, setVentas] = useState<any[]>([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const canManage = profile?.roles?.some(role => ['superadmin', 'vendedor'].includes(role));

    const loadVentas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchVentasService();
            setVentas(data);
        } catch (err: any) {
            console.error("[VentasPage] Failed to fetch data:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleStatusChange = async (ventaId: string, newStatus: Venta['estado']) => {
        setUpdatingStatus(prev => ({ ...prev, [ventaId]: true }));
        const originalVentas = JSON.parse(JSON.stringify(ventas));

        setVentas(prevVentas =>
            prevVentas.map(venta =>
                venta.id === ventaId ? { ...venta, estado: newStatus } : venta
            )
        );

        try {
            await updateVentaStatus(ventaId, newStatus);
        } catch (err: any) {
            setVentas(originalVentas);
            setError(err);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [ventaId]: false }));
        }
    };

    const handleDelete = async (ventaId: string, clienteNombre: string | undefined) => {
        const saleIdentifier = clienteNombre && clienteNombre !== 'Consumidor Final' ? `la venta a "${clienteNombre}"` : `esta venta`;
        if (window.confirm(`¿Estás seguro de que quieres eliminar ${saleIdentifier}? Esta acción restaurará el stock y no se puede deshacer.`)) {
            try {
                await deleteVenta(ventaId);
                await loadVentas();
            } catch (err: any) {
                setError(err);
            }
        }
    };

    const getContactInfo = (venta: any) => {
        let nombre = (venta.clienteNombre || 'Cliente').split(' ')[0];
        let telefono = venta.clienteTelefono || '';

        if (venta.observaciones && venta.observaciones.startsWith('WEB MP')) {
            const webInfo = extractWebInfo(venta.observaciones);
            if (webInfo?.nombre) nombre = webInfo.nombre.split(' ')[0];
            if (webInfo?.telefono) telefono = webInfo.telefono;
        }

        return { nombre, telefono };
    };

    const constructWhatsappUrl = (venta: any) => {
        const { nombre, telefono } = getContactInfo(venta);
        if (!telefono) return null;
        const cleanTel = telefono.replace(/\D/g, '');
        
        const firstProd = venta.items.length > 0 ? venta.items[0].productoNombre : 'productos';
        const prodText = venta.items.length > 1 ? `${firstProd} y otros` : firstProd;

        let message = '';
        if (venta.estado === 'Carrito Abandonado') {
            message = `Hola ${nombre}, vi que dejaste algunos productos de Isabella de la Perla en tu carrito 🛒. ¿Tuviste algún problema con el pago o alguna duda con los productos? ¡Estamos para ayudarte a completar tu pedido! ✨`;
        } else {
            message = `Hola ${nombre}, hemos recibido tu pedido de ${prodText}, ¿podrías enviarnos el comprobante de pago? o en caso de que no hayas podido pagar, ¿si tuviste alguna dificultad de en la web que pueda ayudarte?`;
        }

        const fullTel = cleanTel.startsWith('54') ? cleanTel : '549' + cleanTel;
        return `https://wa.me/${fullTel}?text=${encodeURIComponent(message)}`;
    };

    useEffect(() => {
        loadVentas();
    }, [loadVentas]);

    return (
        <div className="space-y-6">
            <PageHeader title="Ventas y Pedidos Online">
                {canManage && (
                    <Link to="/ventas/crear" className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-all transform hover:scale-105">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nueva Venta Manual
                    </Link>
                )}
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            
            <div className="bg-surface rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Venta</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Cargando ventas...</td></tr>
                        ) : ventas.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay ventas registradas.</td></tr>
                        ) : ventas.map((item) => (
                            <React.Fragment key={item.id}>
                                <tr 
                                    onClick={() => toggleRow(item.id)}
                                    className={`cursor-pointer transition-colors hover:bg-violet-50/50 ${expandedRows[item.id] ? 'bg-violet-50' : ''}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`p-2 rounded-lg mr-3 ${expandedRows[item.id] ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                <IconEye className="h-4 w-4" />
                                            </div>
                                            <span className="font-mono text-xs font-bold text-gray-500">#{item.id.substring(0,6).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-gray-900">{item.clienteNombre}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{item.puntoDeVenta || 'Canal Manual'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.fecha}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${item.total.toLocaleString('es-AR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(() => {
                                            let colors = 'bg-gray-100 text-gray-800';
                                            switch (item.estado) {
                                                case 'Pendiente': colors = 'bg-yellow-100 text-yellow-800'; break;
                                                case 'Pagada': colors = 'bg-green-100 text-green-800'; break;
                                                case 'Enviada': colors = 'bg-blue-100 text-blue-800'; break;
                                                case 'Cancelada': colors = 'bg-red-100 text-red-800'; break;
                                                case 'Carrito Abandonado': colors = 'bg-orange-100 text-orange-800 border border-orange-200'; break;
                                            }
                                            return <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${colors}`}>{item.estado}</span>
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center space-x-3">
                                            {constructWhatsappUrl(item) && (
                                                <a 
                                                    href={constructWhatsappUrl(item)!} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className={`p-2 rounded-full text-white transition-all transform hover:scale-110 shadow-sm ${item.estado === 'Carrito Abandonado' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
                                                    title={item.estado === 'Carrito Abandonado' ? 'Recuperar Carrito' : 'Contactar por WhatsApp'}
                                                >
                                                    <IconBrandWhatsapp className="h-4 w-4" />
                                                </a>
                                            )}
                                            <select
                                                value={item.estado}
                                                onChange={(e) => handleStatusChange(item.id, e.target.value as Venta['estado'])}
                                                disabled={updatingStatus[item.id]}
                                                className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase focus:ring-primary focus:border-primary disabled:opacity-50"
                                            >
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="Pagada">Pagada</option>
                                                <option value="Enviada">Enviada</option>
                                                <option value="Carrito Abandonado">Abandonado</option>
                                                <option value="Cancelada">Cancelada</option>
                                            </select>
                                            {canManage && (
                                                <button
                                                    onClick={() => handleDelete(item.id, item.clienteNombre)}
                                                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                                    title="Eliminar y Restaurar Stock"
                                                >
                                                    <IconTrash className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedRows[item.id] && (
                                    <tr>
                                        <td colSpan={6} className="p-0">
                                            <VentaDetailContent venta={item} />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <style>{`
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.2s ease-out; }
            `}</style>
        </div>
    );
};

export default Ventas;
