
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Venta } from '@/types';
import { IconPlus, IconTrash, IconBrandWhatsapp, IconEye, IconX, IconPackage, IconTruck, IconClock, IconWorld } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVentas as fetchVentasService, updateVentaStatus, deleteVenta } from '@/services/ventasService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

// Helper para extraer información estructurada
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

// Componente Badge de Estado
const StatusBadge: React.FC<{ estado: Venta['estado'] }> = ({ estado }) => {
    const configs: Record<string, string> = {
        'Pendiente': 'bg-amber-100 text-amber-800 border-amber-200',
        'Pagada': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Enviada': 'bg-sky-100 text-sky-800 border-sky-200',
        'Cancelada': 'bg-rose-100 text-rose-800 border-rose-200',
        'Carrito Abandonado': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return (
        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border ${configs[estado] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
            {estado}
        </span>
    );
};

// Componente Badge de Tienda
const StoreBadge: React.FC<{ tienda: string | null | undefined }> = ({ tienda }) => {
    if (!tienda) return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-bold rounded border uppercase">Manual</span>;
    
    const configs: Record<string, string> = {
        'Isabella': 'bg-violet-100 text-violet-700 border-violet-200',
        'Ultrashine': 'bg-cyan-100 text-cyan-700 border-cyan-200',
        'Bodytan': 'bg-orange-100 text-orange-700 border-orange-200',
    };
    
    return (
        <span className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase flex items-center gap-1 ${configs[tienda] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            <IconWorld className="w-2.5 h-2.5" />
            {tienda}
        </span>
    );
};

const VentaDetailContent: React.FC<{ venta: any }> = ({ venta }) => {
    const webInfo = extractWebInfo(venta.observaciones || '');
    const formatPrice = (p: number) => `$${p.toLocaleString('es-AR')}`;

    return (
        <div className="bg-gray-50 border-x-2 border-b-2 border-primary/10 p-6 space-y-6 animate-fade-in-down rounded-b-lg shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Información del Cliente</h4>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-1">
                        <p className="font-bold text-gray-800">{webInfo?.nombre || venta.clienteNombre}</p>
                        {webInfo?.dni && <p className="text-sm text-gray-600">DNI: {webInfo.dni}</p>}
                        <p className="text-sm text-gray-600">Tel: {webInfo?.telefono || venta.clienteTelefono || 'N/A'}</p>
                        <div className="flex gap-2 mt-2">
                             <StoreBadge tienda={venta.tienda} />
                             {venta.puntoDeVenta && <span className="text-[9px] text-gray-400 uppercase font-medium">PDV: {venta.puntoDeVenta}</span>}
                        </div>
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
        const originalVentas = [...ventas];
        setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, estado: newStatus } : v));
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
        if (window.confirm(`¿Seguro que quieres eliminar la venta? Se restaurará el stock.`)) {
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
        const fullTel = cleanTel.startsWith('54') ? cleanTel : '549' + cleanTel;
        let message = `Hola ${nombre}, recibimos tu pedido de la tienda ${venta.tienda || ''}. ¿Tuviste algún problema con el pago?`;
        if (venta.estado === 'Pagada') message = `Hola ${nombre}, ya registramos el pago de tu pedido en ${venta.tienda || ''}. ¡Pronto te avisaremos del envío!`;
        return `https://wa.me/${fullTel}?text=${encodeURIComponent(message)}`;
    };

    useEffect(() => { loadVentas(); }, [loadVentas]);

    return (
        <div className="space-y-6">
            <PageHeader title="Gestión de Pedidos Multi-Tienda">
                {canManage && (
                    <Link to="/ventas/crear" className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-all transform hover:scale-105">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Venta Manual
                    </Link>
                )}
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            
            <div className="bg-surface rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="th-style">Origen</th>
                            <th className="th-style">Cliente</th>
                            <th className="th-style">Fecha</th>
                            <th className="th-style text-right">Total</th>
                            <th className="th-style">Estado</th>
                            <th className="th-style text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 animate-pulse">Cargando pedidos...</td></tr>
                        ) : ventas.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay pedidos.</td></tr>
                        ) : ventas.map((item) => (
                            <React.Fragment key={item.id}>
                                <tr 
                                    onClick={() => toggleRow(item.id)}
                                    className={`cursor-pointer transition-colors group ${expandedRows[item.id] ? 'bg-violet-50/50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <StoreBadge tienda={item.tienda} />
                                            <span className="text-[10px] font-mono text-gray-400 group-hover:text-primary transition-colors">#{item.id.substring(0,6).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-900">{item.clienteNombre}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase">{item.puntoDeVenta || 'Caja'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.fecha}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-gray-900 text-right">${item.total.toLocaleString('es-AR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge estado={item.estado} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center space-x-3">
                                            {constructWhatsappUrl(item) && (
                                                <a 
                                                    href={constructWhatsappUrl(item)!} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className={`p-2 rounded-full text-white transition-all transform hover:scale-110 shadow-sm ${item.estado === 'Carrito Abandonado' ? 'bg-orange-500' : 'bg-green-500'}`}
                                                >
                                                    <IconBrandWhatsapp className="h-4 w-4" />
                                                </a>
                                            )}
                                            <select
                                                value={item.estado}
                                                onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                                                className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase focus:ring-primary"
                                            >
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="Pagada">Pagada</option>
                                                <option value="Enviada">Enviada</option>
                                                <option value="Carrito Abandonado">Abandonado</option>
                                                <option value="Cancelada">Cancelada</option>
                                            </select>
                                            {canManage && (
                                                <button onClick={() => handleDelete(item.id, item.clienteNombre)} className="text-gray-300 hover:text-red-500 p-2"><IconTrash className="h-4 w-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedRows[item.id] && (
                                    <tr><td colSpan={6} className="p-0"><VentaDetailContent venta={item} /></td></tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <style>{`
                .th-style { padding: 1rem 1.5rem; text-align: left; font-size: 0.7rem; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.1em; }
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.2s ease-out; }
            `}</style>
        </div>
    );
};

export default Ventas;
