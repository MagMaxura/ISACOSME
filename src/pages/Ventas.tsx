import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Venta, SimpleCliente } from '@/types';
import { IconPlus, IconTrash, IconBrandWhatsapp, IconEye, IconX, IconPackage, IconTruck, IconClock, IconWorld, IconFileText, IconCheck, IconUsers, IconUserPlus, IconUserCheck, IconArrowLeft } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVentas as fetchVentasService, updateVentaStatus, deleteVenta, assignClientToVenta } from '@/services/ventasService';
import { fetchSimpleClientes, createCliente } from '@/services/clientesService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

// Tipos para las pestañas
type SalesTab = 'PENDIENTE' | 'CONTACTADO' | 'PAGADA' | 'ENVIADA' | 'OTROS';

// Helper para extraer información estructurada de las observaciones
const extractWebInfo = (obs: string) => {
    if (!obs || (!obs.startsWith('WEB MP') && !obs.startsWith('WEB TRANSFERENCIA'))) return null;
    const info: any = { raw: obs };
    const nameMatch = obs.match(/ - (.*?) \(DNI/);
    if (nameMatch) info.nombre = nameMatch[1];
    const dniMatch = obs.match(/\(DNI:\s*(\d+)\)/);
    if (dniMatch) info.dni = dniMatch[1];
    const telMatch = obs.match(/Tel:\s*(\d+)/);
    if (telMatch) info.telefono = telMatch[1];
    const addrMatch = obs.match(/Dirección:\s*(.*)/);
    if (addrMatch) {
        info.direccionCompleta = addrMatch[1];
        // Intentar parsear dirección
        const parts = info.direccionCompleta.split(',').map((p: string) => p.trim());
        info.direccion = parts[0] || '';
        info.localidad = parts[1] || '';
        info.provincia = parts[2] || '';
        const cpMatch = info.direccionCompleta.match(/\(CP:\s*(\d+)\)/);
        if (cpMatch) info.codigoPostal = cpMatch[1];
    }
    const shipMatch = obs.match(/\[(.*?)\]/);
    if (shipMatch) info.envioStatus = shipMatch[1];
    return info;
};

// Componente Badge de Estado
const StatusBadge: React.FC<{ estado: Venta['estado'] }> = ({ estado }) => {
    const configs: Record<string, string> = {
        'Pendiente': 'bg-amber-100 text-amber-800 border-amber-200',
        'Contactado': 'bg-indigo-100 text-indigo-800 border-indigo-200',
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

// MODAL PARA VINCULAR CLIENTE
const AssignClientModal: React.FC<{
    venta: Venta;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ venta, onClose, onSuccess }) => {
    const [clients, setClients] = useState<SimpleCliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSimpleClientes()
            .then(setClients)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [clients, searchTerm]);

    const handleAssign = async (clientId: string) => {
        setLoading(true);
        try {
            await assignClientToVenta(venta.id, clientId);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Vincular a Cliente</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX className="w-5 h-5" /></button>
                </div>
                <div className="p-4 border-b">
                    <input 
                        type="text" 
                        placeholder="Buscar cliente por nombre o email..." 
                        className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Cargando clientes...</div>
                    ) : filteredClients.length > 0 ? (
                        filteredClients.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => handleAssign(c.id)}
                                className="w-full text-left p-3 rounded-lg hover:bg-violet-50 transition-colors flex justify-between items-center group"
                            >
                                <div>
                                    <p className="font-bold text-gray-800 group-hover:text-primary">{c.nombre}</p>
                                    <p className="text-xs text-gray-500">{c.email || 'Sin email'}</p>
                                </div>
                                <IconUserCheck className="w-4 h-4 text-gray-300 group-hover:text-primary" />
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">No se encontraron clientes.</div>
                    )}
                </div>
                {error && <div className="p-3 bg-red-50 text-red-600 text-xs">{error}</div>}
            </div>
        </div>
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
                        <p className="text-lg font-bold text-gray-800">{webInfo?.nombre || venta.clienteNombre}</p>
                        
                        {(webInfo || venta.clienteNombre === 'Consumidor Final') && (
                            <p className="text-[10px] font-bold text-primary uppercase tracking-tight bg-primary/5 px-2 py-0.5 rounded inline-block">
                                Condición: Consumidor Final
                            </p>
                        )}

                        <div className="mt-2 space-y-1 border-t pt-2">
                            {webInfo?.dni && <p className="text-sm text-gray-600"><strong>DNI:</strong> {webInfo.dni}</p>}
                            <p className="text-sm text-gray-600"><strong>Tel:</strong> {webInfo?.telefono || venta.clienteTelefono || 'N/A'}</p>
                        </div>
                        
                        <div className="flex gap-2 mt-3">
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

                    {venta.observaciones && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg shadow-sm">
                            <h5 className="text-[10px] font-bold text-amber-600 uppercase mb-1 flex items-center gap-1">
                                <IconFileText className="w-3 h-3" /> Nota del Pedido / Observaciones:
                            </h5>
                            <p className="text-xs text-amber-900 italic leading-relaxed whitespace-pre-wrap">
                                {venta.observaciones}
                            </p>
                        </div>
                    )}
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
    
    // Estados para vinculación
    const [selectedVentaForAssign, setSelectedVentaForAssign] = useState<Venta | null>(null);
    const [creatingClientId, setCreatingClientId] = useState<string | null>(null);

    // Estado para la pestaña activa y buscador
    const [activeTab, setActiveTab] = useState<SalesTab>('PENDIENTE');
    const [searchTerm, setSearchTerm] = useState('');

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

    // Filtrado por buscador y luego por pestañas
    const filteredVentas = useMemo(() => {
        const s = searchTerm.toLowerCase().trim();
        const baseFiltered = s === '' ? ventas : ventas.filter(v => 
            (v.clienteNombre?.toLowerCase() || '').includes(s) ||
            (v.observaciones?.toLowerCase() || '').includes(s) ||
            (v.id?.toLowerCase() || '').includes(s)
        );

        return {
            PENDIENTE: baseFiltered.filter(v => v.estado === 'Pendiente'),
            CONTACTADO: baseFiltered.filter(v => v.estado === 'Contactado'),
            PAGADA: baseFiltered.filter(v => v.estado === 'Pagada'),
            ENVIADA: baseFiltered.filter(v => v.estado === 'Enviada'),
            OTROS: baseFiltered.filter(v => !['Pendiente', 'Contactado', 'Pagada', 'Enviada'].includes(v.estado)),
        };
    }, [ventas, searchTerm]);

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

    const handleCreateClientFromWeb = async (venta: Venta) => {
        const info = extractWebInfo(venta.observaciones || '');
        if (!info) return;

        if (!window.confirm(`¿Quieres crear el cliente "${info.nombre}" en la base de datos y vincular este pedido?`)) return;

        setCreatingClientId(venta.id);
        try {
            // Creamos el cliente
            const newClientData = {
                nombre: info.nombre,
                telefono: info.telefono,
                dni: info.dni,
                direccion: info.direccion,
                localidad: info.localidad,
                provincia: info.provincia,
                codigoPostal: info.codigoPostal,
                email: null, // No viene en la nota típicamente
                rubro: 'Venta Minorista Web',
            };
            
            // Usamos el servicio existente de clientes
            await createCliente(newClientData as any);
            
            // Necesitamos el ID del cliente recién creado. 
            // Para simplicidad, volvemos a cargar ventas y pedimos al usuario que lo vincule o 
            // mejoramos el servicio para que devuelva el ID.
            // Dado el sistema actual, lo más robusto es recargar y pedir que elija, 
            // pero vamos a intentar buscarlo por DNI o Nombre.
            
            const simpleClients = await fetchSimpleClientes();
            const found = simpleClients.find(c => c.nombre === info.nombre);
            
            if (found) {
                await assignClientToVenta(venta.id, found.id);
                alert("Cliente creado y pedido vinculado con éxito.");
                await loadVentas();
            } else {
                alert("Cliente creado. Por favor vincúlalo manualmente ahora.");
                setSelectedVentaForAssign(venta);
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setCreatingClientId(null);
        }
    };

    const getDisplayName = (venta: any) => {
        if (venta.observaciones && (venta.observaciones.startsWith('WEB MP') || venta.observaciones.startsWith('WEB TRANSFERENCIA'))) {
            const webInfo = extractWebInfo(venta.observaciones);
            if (webInfo?.nombre) return webInfo.nombre;
        }
        return venta.clienteNombre || 'Consumidor Final';
    };

    const constructWhatsappUrl = (venta: any) => {
        const displayName = getDisplayName(venta);
        const firstName = displayName.split(' ')[0];
        let telefono = venta.clienteTelefono || '';
        
        if (venta.observaciones && (venta.observaciones.startsWith('WEB MP') || venta.observaciones.startsWith('WEB TRANSFERENCIA'))) {
            const webInfo = extractWebInfo(venta.observaciones);
            if (webInfo?.telefono) telefono = webInfo.telefono;
        }

        if (!telefono) return null;
        const cleanTel = telefono.replace(/\D/g, '');
        const fullTel = cleanTel.startsWith('54') ? cleanTel : '549' + cleanTel;
        
        let message = '';
        if (venta.estado === 'Carrito Abandonado') {
            message = `Hola ${firstName}, vi que dejaste algunos productos de Isabella de la Perla en tu carrito 🛒. ¿Tuviste algún problema con el pago? ✨`;
        } else if (venta.estado === 'Pagada') {
            message = `Hola ${firstName}, ya registramos el pago de tu pedido. ¡Pronto te avisaremos del envío!`;
        } else if (venta.estado === 'Contactado') {
            message = `Hola ${firstName}, ¡un gusto seguir en contacto! ¿Pudiste ver los detalles del pedido que hablamos? 😊`;
        } else {
            message = `Hola ${firstName}, recibimos tu pedido. ¿Tuviste algún problema con el pago?`;
        }

        return `https://wa.me/${fullTel}?text=${encodeURIComponent(message)}`;
    };

    const getProductsSummary = (items: any[]) => {
        if (!items || items.length === 0) return 'Sin productos';
        return items.map(item => `${item.productoNombre} x ${item.cantidad}`).join(', ');
    };

    useEffect(() => { loadVentas(); }, [loadVentas]);

    return (
        <div className="space-y-6">
            <PageHeader title="Pedidos Multi-Tienda">
                {canManage && (
                    <Link to="/ventas/crear" className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-all transform hover:scale-105">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Venta Manual
                    </Link>
                )}
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            
            {/* BUSCADOR Y TABS */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-gray-200">
                <div className="flex gap-2 sm:gap-6 overflow-x-auto pb-px">
                    {[
                        { id: 'PENDIENTE', label: 'Pendientes', icon: <IconClock className="w-4 h-4" /> },
                        { id: 'CONTACTADO', label: 'Contactados', icon: <IconBrandWhatsapp className="w-4 h-4" /> },
                        { id: 'PAGADA', label: 'Pagados', icon: <IconCheck className="w-4 h-4" /> },
                        { id: 'ENVIADA', label: 'Enviados', icon: <IconTruck className="w-4 h-4" /> },
                        { id: 'OTROS', label: 'Otros', icon: <IconFileText className="w-4 h-4" /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as SalesTab)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                                activeTab === tab.id 
                                    ? 'border-primary text-primary bg-primary/5' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {filteredVentas[tab.id as SalesTab].length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* BUSCADOR GLOBAL */}
                <div className="pb-3 px-4 lg:px-0">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Buscar cliente, nota o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full lg:w-80 pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all group-hover:border-primary"
                        />
                        <div className="absolute left-3 top-2.5 text-gray-400 group-hover:text-primary transition-colors">
                            <IconUsers className="w-4 h-4" />
                        </div>
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="th-style">Origen</th>
                            <th className="th-style">Cliente / Pedido</th>
                            <th className="th-style">Fecha</th>
                            <th className="th-style text-right">Total</th>
                            <th className="th-style">Estado</th>
                            <th className="th-style text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 animate-pulse">Cargando pedidos...</td></tr>
                        ) : filteredVentas[activeTab].length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay pedidos que coincidan.</td></tr>
                        ) : filteredVentas[activeTab].map((item) => {
                            const displayName = getDisplayName(item);
                            const productsSummary = getProductsSummary(item.items);
                            const webInfo = extractWebInfo(item.observaciones || '');
                            const isConsumidorFinal = item.clienteNombre === 'Consumidor Final';

                            // Verificamos si en esta pestaña mostramos la nota completa
                            const showFullNote = activeTab === 'PENDIENTE' || activeTab === 'CONTACTADO' || activeTab === 'ENVIADA';

                            return (
                            <React.Fragment key={item.id}>
                                <tr 
                                    onClick={() => toggleRow(item.id)}
                                    className={`cursor-pointer transition-colors group ${expandedRows[item.id] ? 'bg-violet-50/50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <div className="flex flex-col gap-1">
                                            <StoreBadge tienda={item.tienda} />
                                            <span className="text-[10px] font-mono text-gray-400 group-hover:text-primary transition-colors">#{item.id.substring(0,6).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-bold text-gray-900">{displayName}</div>
                                            {isConsumidorFinal && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedVentaForAssign(item); }}
                                                        className="p-1 text-gray-400 hover:text-primary transition-colors"
                                                        title="Vincular a cliente existente"
                                                    >
                                                        <IconUserCheck className="w-3.5 h-3.5" />
                                                    </button>
                                                    {webInfo && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleCreateClientFromWeb(item); }}
                                                            disabled={creatingClientId === item.id}
                                                            className="p-1 text-gray-400 hover:text-primary transition-colors"
                                                            title="Crear nuevo cliente con estos datos"
                                                        >
                                                            {creatingClientId === item.id ? (
                                                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                            ) : (
                                                                <IconUserPlus className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-primary font-bold uppercase truncate max-w-[200px]" title={productsSummary}>
                                            {productsSummary}
                                        </div>
                                        {item.observaciones && (
                                            <div className={`mt-1 text-[10px] text-gray-600 leading-tight border-t border-gray-50 pt-1 ${
                                                showFullNote 
                                                    ? 'bg-amber-50/50 p-1.5 rounded italic font-medium text-gray-700 whitespace-pre-wrap max-w-md' 
                                                    : 'truncate max-w-[300px] italic'
                                            }`} title={!showFullNote ? item.observaciones : undefined}>
                                                {item.observaciones}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">{item.fecha}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-gray-900 text-right align-top">${item.total.toLocaleString('es-AR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <StatusBadge estado={item.estado} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center align-top" onClick={(e) => e.stopPropagation()}>
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
                                                <option value="Contactado">Contactado</option>
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
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE VINCULACIÓN */}
            {selectedVentaForAssign && (
                <AssignClientModal 
                    venta={selectedVentaForAssign} 
                    onClose={() => setSelectedVentaForAssign(null)} 
                    onSuccess={() => { setSelectedVentaForAssign(null); loadVentas(); }}
                />
            )}

            <style>{`
                .th-style { padding: 1rem 1.5rem; text-align: left; font-size: 0.7rem; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.1em; }
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.2s ease-out; }
            `}</style>
        </div>
    );
};

export default Ventas;