import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { IconPlus, IconPencil, IconClipboardPlus } from '@/components/Icons';
import { Insumo } from '@/types';
import Table, { Column } from '@/components/Table';
import { useAuth } from '@/contexts/AuthContext';
import { fetchInsumos } from '@/services/insumosService';
import InsumoModal from '@/components/InsumoModal';
import StockUpdateModal from '@/components/StockUpdateModal';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

const StockInsumos: React.FC = () => {
    const { profile } = useAuth();
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
    const [error, setError] = useState<any | null>(null);

    const canManage = profile?.roles?.some(role => ['superadmin', 'administrativo'].includes(role));
    
    const loadStockData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("[StockInsumosPage] Fetching insumos stock.");
            const data = await fetchInsumos();
            setInsumos(data);
            console.log("[StockInsumosPage] Insumos fetched successfully.", data);
        } catch (err: any) {
            console.error(`[StockInsumosPage] Error fetching data:`, err);
            setError(err);
        } finally {
            setLoading(false);
            console.log(`[StockInsumosPage] Fetch finished.`);
        }
    }, []);

    useEffect(() => {
        loadStockData();
    }, [loadStockData]);

    const handleOpenCreateModal = () => {
        setSelectedInsumo(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (insumo: Insumo) => {
        setSelectedInsumo(insumo);
        setIsModalOpen(true);
    };
    
    const handleOpenStockModal = (insumo: Insumo) => {
        setSelectedInsumo(insumo);
        setIsStockModalOpen(true);
    };

    const handleModalSuccess = () => {
        setIsModalOpen(false);
        setSelectedInsumo(null);
        loadStockData();
    };
    
    const handleStockModalSuccess = () => {
        setIsStockModalOpen(false);
        setSelectedInsumo(null);
        loadStockData();
    };

    const insumoColumns: Column<Insumo>[] = [
        { header: 'Insumo', accessor: 'nombre', render: item => <span className="font-semibold">{item.nombre}</span> },
        { header: 'Categoría', accessor: 'categoria' },
        { header: 'Proveedor', accessor: 'proveedor' },
        { header: 'Stock Actual', accessor: 'stock', render: item => (
             <span className={`font-bold ${item.stock < 100 ? 'text-red-500' : 'text-green-600'}`}>
                {item.stock} {item.unidad}
            </span>
        )},
        { header: 'Costo Unitario', accessor: 'costo', render: item => `$${item.costo.toLocaleString('es-AR')}` },
        { header: 'Acciones', accessor: 'id', render: (item) => (
            canManage && (
                <div className="flex space-x-3">
                    <button onClick={() => handleOpenEditModal(item)} className="text-blue-500 hover:text-blue-700" title="Editar Insumo">
                        <IconPencil className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleOpenStockModal(item)} className="text-green-500 hover:text-green-700" title="Registrar Compra / Agregar Stock">
                        <IconClipboardPlus className="h-5 w-5" />
                    </button>
                </div>
            )
        )},
    ];

    return (
        <div>
            <PageHeader title="Stock de Insumos y Materias Primas">
                {canManage && (
                    <button 
                        onClick={handleOpenCreateModal}
                        className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-colors"
                    >
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nuevo Insumo
                    </button>
                )}
            </PageHeader>
            
            <DatabaseErrorDisplay error={error} />

            <Table columns={insumoColumns} data={insumos} isLoading={loading} />

            {isModalOpen && (
                <InsumoModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={handleModalSuccess}
                    insumoToEdit={selectedInsumo}
                />
            )}
            
            {isStockModalOpen && (
                <StockUpdateModal
                    isOpen={isStockModalOpen}
                    onClose={() => setIsStockModalOpen(false)}
                    onSuccess={handleStockModalSuccess}
                    insumo={selectedInsumo}
                />
            )}
        </div>
    );
};

export default StockInsumos;