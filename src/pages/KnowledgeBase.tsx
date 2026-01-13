
import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { IconPlus, IconX, IconPencil, IconTrash, IconMessage2, IconFileText } from '@/components/Icons';
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
            item.pregunta.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.respuesta.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
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
        <div>
            <PageHeader title="Entrenamiento Chatbot">
                <button onClick={handleOpenCreate} className="flex items-center bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary-dark transition-all transform hover:scale-105">
                    <IconPlus className="h-5 w-5 mr-2" />
                    Nueva Pregunta
                </button>
            </PageHeader>

            <DatabaseErrorDisplay error={error} />

            <div className="mb-6 bg-violet-50 border-l-4 border-primary p-4 rounded-r-lg shadow-sm">
                <div className="flex gap-3">
                    <IconMessage2 className="w-6 h-6 text-primary flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-primary uppercase tracking-wider">Base de Conocimiento</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Toda la información cargada aquí será utilizada por el chatbot para responder a los clientes de forma autónoma. Mantén las respuestas claras y actualizadas.
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
                <div className="text-center py-12 text-gray-400">Cargando base de conocimiento...</div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                    No se encontraron registros.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col overflow-hidden group">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {item.categoria}
                                </span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md">
                                        <IconPencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 flex-grow space-y-4">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">Pregunta</h4>
                                    <p className="text-sm font-bold text-gray-800 leading-tight">{item.pregunta}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">Respuesta Recomendada</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed italic border-l-2 border-gray-200 pl-3">
                                        {item.respuesta}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {editingId ? 'Editar Información' : 'Cargar Nueva Información'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Categoría</label>
                                <select 
                                    value={currentItem.categoria}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, categoria: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Pregunta Frecuente</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: ¿Hacen envíos a todo el país?"
                                    value={currentItem.pregunta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, pregunta: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Respuesta Sugerida para el Chatbot</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Redacta una respuesta clara y profesional..."
                                    value={currentItem.respuesta}
                                    onChange={e => setCurrentItem(prev => ({ ...prev, respuesta: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm leading-relaxed"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark shadow-lg disabled:bg-violet-300 transition-all active:scale-95"
                                >
                                    {isSubmitting ? 'Guardando...' : 'Guardar Información'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
            `}</style>
        </div>
    );
};

export default KnowledgeBase;
