import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { IconPhoto, IconTrash, IconCopy, IconPlus, IconSearch, IconX, IconPackage } from '../components/Icons';
import { fetchBuckets, fetchFiles, uploadFile, deleteFile, Bucket, StorageFile } from '../services/storageService';
import DatabaseErrorDisplay from '../components/DatabaseErrorDisplay';

const Imagenes: React.FC = () => {
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    useEffect(() => {
        loadBuckets();
    }, []);

    useEffect(() => {
        if (selectedBucket) {
            loadFiles(selectedBucket);
        }
    }, [selectedBucket]);

    const loadBuckets = async () => {
        setLoading(true);
        try {
            const data = await fetchBuckets();
            setBuckets(data);
            if (data.length > 0) {
                const productBucket = data.find(b => b.name === 'PRODUCTOS');
                setSelectedBucket(productBucket ? productBucket.name : data[0].name);
            }
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const loadFiles = async (bucketName: string) => {
        setLoading(true);
        try {
            const data = await fetchFiles(bucketName);
            setFiles(data);
        } catch (err: any) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        setIsUploading(true);
        setError(null);
        try {
            const file = e.target.files[0];
            await uploadFile(selectedBucket, file);
            await loadFiles(selectedBucket);
        } catch (err: any) {
            setError(err);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (fileName: string) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar "${fileName}"?`)) return;

        try {
            await deleteFile(selectedBucket, fileName);
            setFiles(prev => prev.filter(f => f.name !== fileName));
        } catch (err: any) {
            setError(err);
        }
    };

    const copyToClipboard = (url: string, id: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopySuccess(id);
            setTimeout(() => setCopySuccess(null), 2000);
        });
    };

    const filteredFiles = useMemo(() => {
        return files.filter(file => 
            file.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [files, searchTerm]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Gestión de Imágenes">
                <label className={`flex items-center bg-black text-white px-4 py-2 rounded-lg shadow-lg hover:bg-zinc-800 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <IconPlus className="h-5 w-5 mr-2" />
                    {isUploading ? 'Subiendo...' : 'Subir Nueva Imagen'}
                    <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        disabled={isUploading}
                        accept="image/*"
                    />
                </label>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar de Buckets */}
                <div className="md:col-span-1 space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Buckets Disponibles</h3>
                        <div className="space-y-1">
                            {buckets.map(bucket => (
                                <button
                                    key={bucket.id}
                                    onClick={() => setSelectedBucket(bucket.name)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${selectedBucket === bucket.name ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'}`}
                                >
                                    {bucket.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Contenido Principal */}
                <div className="md:col-span-3 space-y-4">
                    <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Buscar imágenes por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-100 rounded-xl shadow-sm focus:ring-2 focus:ring-black outline-none transition-all"
                        />
                    </div>

                    <DatabaseErrorDisplay error={error} />

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
                            <p className="text-zinc-400 font-medium">Cargando archivos...</p>
                        </div>
                    ) : filteredFiles.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredFiles.map(file => (
                                <div key={file.id} className="group bg-white rounded-xl overflow-hidden border border-zinc-100 shadow-sm hover:shadow-xl transition-all duration-300">
                                    <div className="aspect-square bg-zinc-50 relative overflow-hidden flex items-center justify-center">
                                        {file.metadata.mimetype.startsWith('image/') ? (
                                            <img 
                                                src={file.url} 
                                                alt={file.name} 
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <IconPackage className="h-12 w-12 text-zinc-200" />
                                        )}
                                        
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                            <button 
                                                onClick={() => copyToClipboard(file.url!, file.id)}
                                                className="p-2 bg-white rounded-full text-black hover:bg-zinc-100 transition-colors shadow-lg"
                                                title="Copiar URL"
                                            >
                                                {copySuccess === file.id ? <span className="text-[10px] font-bold px-1">COPIADO</span> : <IconCopy className="h-5 w-5" />}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(file.name)}
                                                className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors shadow-lg"
                                                title="Eliminar"
                                            >
                                                <IconTrash className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3">
                                        <p className="text-xs font-bold text-zinc-800 truncate" title={file.name}>{file.name}</p>
                                        <p className="text-[10px] text-zinc-400 font-medium uppercase mt-1">{formatSize(file.metadata.size)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center py-20 text-center">
                            <div className="bg-zinc-50 p-4 rounded-full mb-4">
                                <IconPhoto className="h-10 w-10 text-zinc-200" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-800">No se encontraron imágenes</h3>
                            <p className="text-zinc-400 max-w-xs mx-auto text-sm mt-2">
                                {searchTerm ? `No hay resultados para "${searchTerm}" en este bucket.` : 'Este bucket está vacío. ¡Sube tu primera imagen!'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Imagenes;
