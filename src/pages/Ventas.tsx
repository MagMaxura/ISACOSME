import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Table, { Column } from '@/components/Table';
import { Venta } from '@/types';
import { IconPlus, IconTrash } from '@/components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVentas as fetchVentasService, updateVentaStatus, deleteVenta } from '@/services/ventasService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

const Ventas: React.FC = () => {
    const { profile } = useAuth();
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({}); // Track loading state per row

    const canManage = profile?.roles?.some(role => ['superadmin', 'vendedor'].includes(role));

    const loadVentas = useCallback(async () => {
        console.log("[VentasPage] Fetching data.");
        setLoading(true);
        setError(null);
        try {
            const data = await fetchVentasService();
            setVentas(data);
            console.log("[VentasPage] Data fetched successfully.", data);
        } catch (err: any) {
            console.error("[VentasPage] Failed to fetch data:", err);
            // Set the full error object to the state.
            setError(err);
        } finally {
            setLoading(false);
            console.log("[VentasPage] Fetch process finished.");
        }
    }, []);

    const handleStatusChange = async (ventaId: string, newStatus: Venta['estado']) => {
        setUpdatingStatus(prev => ({ ...prev, [ventaId]: true }));
        const originalVentas = JSON.parse(JSON.stringify(ventas));

        // Optimistic update
        setVentas(prevVentas =>
            prevVentas.map(venta =>
                venta.id === ventaId ? { ...venta, estado: newStatus } : venta
            )
        );

        try {
            await updateVentaStatus(ventaId, newStatus);
        } catch (err: any) {
            console.error("Failed to update status:", err);
            // Revert on failure
            setVentas(originalVentas);
            // Set the full error object for the display component
            setError(err);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [ventaId]: false }));
        }
    };

    const handleDelete = async (ventaId: string, clienteNombre: string | undefined) => {
        const saleIdentifier = clienteNombre && clienteNombre !== 'Consumidor Final' ? `la venta a "${clienteNombre}"` : `esta venta (ID: ${ventaId.substring(0, 8)}...)`;
        if (window.confirm(`¿Estás seguro de que quieres eliminar ${saleIdentifier}? Esta acción restaurará el stock de los productos vendidos y no se puede deshacer.`)) {
            try {
                await deleteVenta(ventaId);
                await loadVentas(); // Reload data to reflect deletion
            } catch (err: any) {
                console.error("Failed to delete sale:", err);
                setError(err);
            }
        }
    };


    useEffect(() => {
        loadVentas();
    }, [loadVentas]);

    const columns: Column<Venta>[] = [
        { header: 'ID Venta', accessor: 'id', render: (item) => <span className="font-mono text-xs">{item.id.substring(0,8)}...</span> },
        { header: 'Cliente', accessor: 'clienteNombre'},
        { header: 'Fecha', accessor: 'fecha' },
        { header: 'Productos', accessor: 'items', render: (item) => (
             <ul className="text-xs list-disc list-inside">
                {item.items.map((p, index) => (
                    <li key={index}>{p.productoNombre} x {p.cantidad}</li>
                ))}
            </ul>
        )},
        { header: 'Observaciones', accessor: 'observaciones', render: (item) => <p className="text-xs max-w-xs whitespace-normal">{item.observaciones || ''}</p> },
        { header: 'Total', accessor: 'total', render: (item) => <span className="font-semibold">$ {item.total.toLocaleString('es-AR')}</span> },
        { header: 'Tipo', accessor: 'tipo', render: (item) => (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                item.tipo === 'Venta' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>{item.tipo}</span>
        )},
        { header: 'Punto de Venta', accessor: 'puntoDeVenta', render: (item) => (
            item.puntoDeVenta ? <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-violet-100 text-violet-800`}>{item.puntoDeVenta}</span> : <span className="text-gray-400">-</span>
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
            return (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                    {item.estado}
                </span>
            )
        }},
    ];

    if (canManage) {
        columns.push({
            header: 'Acciones',
            accessor: 'id',
            render: (item) => (
                <div className="flex items-center space-x-2">
                    <select
                        value={item.estado}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as Venta['estado'])}
                        disabled={updatingStatus[item.id]}
                        className="p-1 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-wait"
                    >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pagada">Pagada</option>
                        <option value="Enviada">Enviada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                    <button
                        onClick={() => handleDelete(item.id, item.clienteNombre)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-100 transition-colors"
                        title="Eliminar Venta y Restaurar Stock"
                    >
                        <IconTrash className="h-5 w-5" />
                    </button>
                </div>
            )
        });
    }

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