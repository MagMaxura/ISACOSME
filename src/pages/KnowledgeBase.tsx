
import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { IconPlus, IconX, IconPencil, IconTrash, IconMessage2, IconFileText, IconAlertCircle } from '@/components/Icons';
import { KnowledgeItem } from '@/types';
import { fetchKnowledgeBase, createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '@/services/knowledgeService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';

const KnowledgeBase: React.FC = () => {
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [currentItem, setCurrentItem] = useState<Partial<KnowledgeItem>>({
        pregunta: '',
        respuesta: '',
        categoria: 'General'
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categories = ['General', 'Envíos', 'Pagos', 'Productos', 'Precios', 'Políticas', 'Contacto'];

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchKnowledgeBase();
            setItems(data);
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter(item => 
            (item.pregunta?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.respuesta?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.categoria?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm]);

    const handleOpenCreate = () => {
        setEditingId(null);
        setCurrentItem({ pregunta: '', respuesta: '', categoria: 'General' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: KnowledgeItem) => {
        setEditingId(item.id);
        setCurrentItem({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar esta pregunta frecuente?')) return;
        try {
            await deleteKnowledgeItem(id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err: any) {
            setError(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentItem.pregunta || !currentItem.respuesta) return;

        setIsSubmitting(true);
        setError(null);
        try {
            if (editingId) {
                await updateKnowledgeItem(editingId, currentItem);
            } else {
                const newItem = await createKnowledgeItem(currentItem);
                setItems(prev => [newItem, ...prev]);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            setError(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <PageHeader title="Entrenamiento Chatbot">
                <div className="flex gap-2">
                    <button 
                        onClick={loadData} 
                        className="p-2 text-gray-400 hover:text-primary transition-colors bg-white rounded-lg shadow-sm border border-gray-100"
                        title="Reintentar carga"
                    >
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button onClick={handleOpenCreate} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-all transform hover:scale-105">
                        <IconPlus className="h-5 w-5 mr-2" />
                        Nueva Pregunta
                    </button>
                </div>
            </PageHeader>

            <DatabaseErrorDisplay error={error} />

            {error && (
                <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
                    <p className="text-sm font-bold text-amber-800">¿Aplicaste el SQL y el error persiste?</p>
                    <p className="text-xs text-amber-700 mt-1">
                        A veces el navegador cachea los permisos. Intenta <strong>Cerrar Sesión</strong> e ingresar nuevamente después de ejecutar el script en Supabase.
                    </p>
                </div>
            )}

            <div className="mb-6 bg-violet-50 border-l-4 border-primary p-4 rounded-r-lg shadow-sm">
                <div className="flex gap-3">
                    <IconMessage2 className="w-6 h-6 text-primary flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-primary uppercase tracking-wider">Base de Conocimiento</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Toda la información cargada aquí será utilizada por el chatbot para responder a los clientes de forma autónoma.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-6 relative group">
                <input
                    type="text"
                    placeholder="Buscar en preguntas o respuestas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm group-hover:border-primary/30"
                />
                <IconFileText className="absolute left-3 top-3.5 text-gray-400 w-4 h-4 group-hover:text-primary transition-colors" />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium">Sincronizando base de conocimiento...</p>
                </div>
            ) : filteredItems.length === 0 && !error ? (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <IconAlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No se encontraron registros</p>
                    <p className="text-xs">Agrega una nueva pregunta para entrenar al bot.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col overflow-hidden group">
                            <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full">
                                    {item.categoria}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                                        <IconPencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 flex-grow space-y-5">
                                <div className="relative pl-6">
                                    <span className="absolute left-0 top-0 text-primary/30 font-serif text-2xl font-bold">Q</span>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Pregunta del Usuario</h4>
                                    <p className="text-sm font-bold text-gray-800 leading-snug">{item.pregunta}</p>
                                </div>
                                <div className="relative pl-6">
                                    <span className="absolute left-0 top-0 text-secondary/30 font-serif text-2xl font-bold">A</span>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Respuesta del Chatbot</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                                        {item.respuesta}
                                    </p>
                                </div>
                            </div>
                            <div className="px-5 py-3 bg-gray-50 border-t flex justify-between items-center">
                                <span className="text-[9px] text-gray-400 font-medium italic">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </span>
                                <div className="flex gap-1 items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                    <span className="text-[9px] text-green-600 font-bold uppercase tracking-tighter">Entrenado</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {editingId ? 'Editar Entrenamiento' : 'Nuevo Entrenamiento'}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">Configura la respuesta del bot</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-xl shadow-sm text-gray-400 hover:text-gray-600 transition-all hover:rotate-90">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Área temática</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {categories.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCurrentItem(prev => ({ ...prev, categoria: c }))}
                                            className={`px-2 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                                                currentItem.categoria === c 
                                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary/50'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Pregunta que hace el cliente</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: ¿Qué pasa si el producto llega roto?"
                                    value={currentItem.pregunta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, pregunta: e.target.value }))}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm font-bold transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Respuesta oficial de Isabella</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Explica el procedimiento oficial de forma amable..."
                                    value={currentItem.respuesta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, respuesta: e.target.value }))}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm leading-relaxed transition-all"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="px-8 py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 disabled:bg-violet-300 transition-all active:scale-95"
                                >
                                    {isSubmitting ? 'Procesando...' : (editingId ? 'Actualizar' : 'Guardar Entrenamiento')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scale-up { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-up { animation: scale-up 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};

export default KnowledgeBase;
