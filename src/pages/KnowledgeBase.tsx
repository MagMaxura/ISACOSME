
import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { IconPlus, IconX, IconPencil, IconTrash, IconMessage2, IconFileText, IconAlertCircle, IconArrowLeft } from '@/components/Icons';
import { KnowledgeItem } from '@/types';
import { fetchKnowledgeBase, createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '@/services/knowledgeService';
import DatabaseErrorDisplay from '@/components/DatabaseErrorDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const KnowledgeBase: React.FC = () => {
    const { profile } = useAuth();
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

    // Permisos: solo Staff puede VER y EDITAR esta sección
    const isStaff = profile?.roles?.some(role => 
        ['superadmin', 'vendedor', 'administrativo', 'analitico'].includes(role)
    );

    const categories = ['General', 'Envíos', 'Pagos', 'Productos', 'Precios', 'Políticas', 'Contacto'];

    const loadData = async () => {
        if (!isStaff) return;
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
    }, [isStaff]);

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

    // Si no es staff, mostramos pantalla de acceso denegado
    if (!isStaff) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 shadow-sm max-w-md">
                    <IconAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
                    <p className="text-gray-600 mb-6">
                        Esta sección es de uso exclusivo para el personal administrativo y de gestión. 
                        Tus roles actuales no permiten ver el entrenamiento del chatbot.
                    </p>
                    <Link to="/" className="inline-flex items-center text-primary font-bold hover:underline">
                        <IconArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <PageHeader title="Entrenamiento Chatbot">
                <div className="flex gap-2">
                    <button 
                        onClick={loadData} 
                        className="p-2 text-gray-400 hover:text-primary transition-colors bg-white rounded-lg shadow-sm border border-gray-100"
                        title="Refrescar"
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

            <div className="mb-6 bg-violet-50 border-l-4 border-primary p-4 rounded-r-lg shadow-sm">
                <div className="flex gap-3">
                    <IconMessage2 className="w-6 h-6 text-primary flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-primary uppercase tracking-wider">Base de Conocimiento</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Gestiona la información que el chatbot utiliza para responder a los clientes.
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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                />
                <IconFileText className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium">Sincronizando datos...</p>
                </div>
            ) : filteredItems.length === 0 && !error ? (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <IconAlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">Sin registros</p>
                    <p className="text-xs">Usa el botón superior para agregar contenido.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
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
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Usuario</h4>
                                    <p className="text-sm font-bold text-gray-800 leading-snug">{item.pregunta}</p>
                                </div>
                                <div className="relative pl-6">
                                    <span className="absolute left-0 top-0 text-secondary/30 font-serif text-2xl font-bold">A</span>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Chatbot</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                                        {item.respuesta}
                                    </p>
                                </div>
                            </div>
                            <div className="px-5 py-3 bg-gray-50 border-t flex justify-between items-center">
                                <span className="text-[9px] text-gray-400 font-medium">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </span>
                                <div className="flex gap-1 items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                    <span className="text-[9px] text-green-600 font-bold uppercase">Activo</span>
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
                                    {editingId ? 'Editar Pregunta' : 'Nueva Pregunta'}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">Entrenar base de conocimiento</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-xl shadow-sm text-gray-400 hover:text-gray-600">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Categoría</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {categories.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCurrentItem(prev => ({ ...prev, categoria: c }))}
                                            className={`px-2 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                                                currentItem.categoria === c 
                                                    ? 'bg-primary text-white border-primary' 
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Pregunta</label>
                                <input 
                                    type="text" 
                                    value={currentItem.pregunta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, pregunta: e.target.value }))}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm font-bold"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Respuesta</label>
                                <textarea 
                                    rows={4}
                                    value={currentItem.respuesta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, respuesta: e.target.value }))}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm leading-relaxed"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold text-gray-400">
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="px-8 py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-primary-dark shadow-xl disabled:bg-violet-300 transition-all"
                                >
                                    {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
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
