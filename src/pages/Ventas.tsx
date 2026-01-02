import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Table, { Column } from '@/components/Table';
import { Venta } from '@/types';
import { IconPlus, IconTrash, IconBrandWhatsapp } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVentas as fetchVentasService, updateVentaStatus, deleteVenta } from '@/services/ventasService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

const Ventas: React.FC = () => {
    const { profile } = useAuth();
    const [ventas, setVentas] = useState<any[]>([]); // Using any because we added custom fields in service
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

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

    /**
     * Extrae información de contacto de las observaciones de ventas web o del cliente vinculado.
     */
    const getContactInfo = (venta: any) => {
        let nombre = venta.clienteNombre || 'Cliente';
        let telefono = venta.clienteTelefono || '';

        // Si es venta WEB, intentamos extraer del string de observaciones
        if (venta.observaciones && venta.observaciones.startsWith('WEB MP')) {
            // Extraer nombre: entre el guión y el paréntesis del DNI
            const nameMatch = venta.observaciones.match(/ - (.*?) \(DNI/);
            if (nameMatch) nombre = nameMatch[1].split(' ')[0]; // Solo el primer nombre para el saludo

            // Extraer teléfono: después de "Tel: "
            const telMatch = venta.observaciones.match(/Tel:\s*(\d+)/);
            if (telMatch) telefono = telMatch[1];
        }

        return { nombre, telefono };
    };

    const constructWhatsappUrl = (venta: any) => {
        const { nombre, telefono } = getContactInfo(venta);
        if (!telefono) return null;

        // Limpiar el teléfono (solo números)
        const cleanTel = telefono.replace(/\D/g, '');
        
        // Formatear el primer producto para el mensaje
        const firstProd = venta.items.length > 0 ? venta.items[0].productoNombre : 'productos';
        const prodText = venta.items.length > 1 ? `${firstProd} y otros` : firstProd;

        const message = `Hola ${nombre}, hemos recibido tu pedido de ${prodText}, ¿podrías enviarnos el comprobante de pago? o en caso de que no hayas podido pagar, ¿si tuviste alguna dificultad de en la web que pueda ayudarte?`;
        
        return `https://wa.me/${cleanTel.startsWith('54') ? cleanTel : '549' + cleanTel}?text=${encodeURIComponent(message)}`;
    };

    useEffect(() => {
        loadVentas();
    }, [loadVentas]);

    const columns: Column<any>[] = [
        { header: 'ID', accessor: 'id', render: (item) => <span className="font-mono text-xs">{item.id.substring(0,6)}</span> },
        { header: 'Cliente', accessor: 'clienteNombre', render: (item) => {
            const { telefono } = getContactInfo(item);
            return (
                <div>
                    <p className="font-semibold">{item.clienteNombre}</p>
                    {telefono && <p className="text-[10px] text-gray-500">Tel: {telefono}</p>}
                </div>
            );
        }},
        { header: 'Fecha', accessor: 'fecha' },
        { header: 'Productos', accessor: 'items', render: (item) => (
             <ul className="text-[10px] list-disc list-inside">
                {item.items.map((p: any, index: number) => (
                    <li key={index} className="truncate max-w-[150px]">{p.productoNombre} x {p.cantidad}</li>
                ))}
            </ul>
        )},
        { header: 'Total', accessor: 'total', render: (item) => <span className="font-semibold">${item.total.toLocaleString('es-AR')}</span> },
        { header: 'Punto de Venta', accessor: 'puntoDeVenta', render: (item) => (
            item.puntoDeVenta ? <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-violet-100 text-violet-800">{item.puntoDeVenta}</span> : <span className="text-gray-400">-</span>
        )},
        { header: 'Estado', accessor: 'estado', render: (item) => {
            let colorClass = '';
            switch (item.estado) {
                case 'Pendiente': colorClass = 'bg-yellow-100 text-yellow-800'; break;
                case 'Pagada': colorClass = 'bg-green-100 text-green-800'; break;
                case 'Enviada': colorClass = 'bg-blue-100 text-blue-800'; break;
                case 'Cancelada': colorClass = 'bg-red-100 text-red-800'; break;
                default: colorClass = 'bg-gray-100 text-gray-800'; break;
            }
            return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${colorClass}`}>{item.estado}</span>
        }},
        {
            header: 'Acciones',
            accessor: 'id',
            render: (item) => {
                const waUrl = constructWhatsappUrl(item);
                return (
                    <div className="flex items-center space-x-2">
                        {waUrl && (
                            <a 
                                href={waUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm"
                                title="Contactar por WhatsApp"
                            >
                                <IconBrandWhatsapp className="h-4 w-4" />
                            </a>
                        )}
                        <select
                            value={item.estado}
                            onChange={(e) => handleStatusChange(item.id, e.target.value as Venta['estado'])}
                            disabled={updatingStatus[item.id]}
                            className="p-1 border border-gray-300 rounded-md text-xs focus:ring-primary focus:border-primary disabled:bg-gray-100"
                        >
                            <option value="Pendiente">Pendiente</option>
                            <option value="Pagada">Pagada</option>
                            <option value="Enviada">Enviada</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                        {canManage && (
                            <button
                                onClick={() => handleDelete(item.id, item.clienteNombre)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-100 transition-colors"
                                title="Eliminar y Restaurar Stock"
                            >
                                <IconTrash className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                )
            }
        }
    ];

    return (
        <div>
            <PageHeader title="Ventas y Consignaciones">
                {canManage && (
                    <Link to="/ventas/crear" className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nueva Venta
                    </Link>
                )}
            </PageHeader>
            <DatabaseErrorDisplay error={error} />
            <Table columns={columns} data={ventas} isLoading={loading} />
        </div>
    );
};

export default Ventas;