import React, { useState, useEffect, useMemo } from 'react';
import { Producto } from '@/types';
import { IconX } from './Icons';

interface ProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Producto | null;
}

const ProductGalleryModal: React.FC<ProductGalleryModalProps> = ({ isOpen, onClose, product }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = useMemo(() => {
    if (!product) return [];
    const galleryUrls = product.imagenesGaleria?.map(img => img.url) || [];
    return product.imagenUrl ? [product.imagenUrl, ...galleryUrls] : galleryUrls;
  }, [product]);

  useEffect(() => {
    // Reset index when modal opens or product changes
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, product]);
  
  const goToNext = () => {
    setCurrentIndex(prevIndex => (prevIndex + 1) % images.length);
  };

  const goToPrevious = () => {
    setCurrentIndex(prevIndex => (prevIndex - 1 + images.length) % images.length);
  };
  
  if (!isOpen || !product || images.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-title"
    >
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-full flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
            <h3 id="gallery-title" className="text-xl font-semibold text-gray-800">{product.nombre}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar galería">
                <IconX className="w-6 h-6" />
            </button>
        </div>
        
        <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-0">
          <div className="relative w-full h-full max-h-[70vh] flex items-center justify-center">
            <img 
              src={images[currentIndex]} 
              alt={`Imagen ${currentIndex + 1} de ${product.nombre}`} 
              className="max-w-full max-h-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button onClick={goToPrevious} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-60 transition-colors" aria-label="Imagen anterior">
                  &#10094;
                </button>
                <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-60 transition-colors" aria-label="Siguiente imagen">
                  &#10095;
                </button>
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="p-4 border-t">
            <div className="flex justify-center items-center gap-2 overflow-x-auto">
              {images.map((img, index) => (
                <button key={index} onClick={() => setCurrentIndex(index)} className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${currentIndex === index ? 'border-primary' : 'border-transparent'}`} aria-label={`Ver imagen ${index + 1}`}>
                  <img src={img} alt={`Miniatura ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGalleryModal;
