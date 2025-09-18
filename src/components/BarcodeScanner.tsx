import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { IconX } from './Icons';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');

  useEffect(() => {
    if (!videoRef.current) return;

    let isMounted = true;
    const codeReader = new BrowserMultiFormatReader();
    const videoElement = videoRef.current;

    const startScanner = async () => {
      try {
        if (!isMounted) return;

        // The 'decodeContinuously' method might not be available in all versions or environments.
        // We're switching to 'decodeFromVideoDevice' which requires listing devices first,
        // providing a more compatible and explicit way to start the scanner.
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
            throw new Error('No video input devices found');
        }

        const selectedDeviceId = videoInputDevices[0].deviceId;

        const controls = await codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
          if (!isMounted) return;

          if (result) {
            onScan(result.getText());
          }
          
          if (err && err.name !== 'NotFoundException') {
            console.error('Barcode scan error:', err);
            setError('Ocurrió un error durante el escaneo.');
            setStatus('error');
          }
        });
        
        controlsRef.current = controls;

        if (isMounted) {
          setStatus('scanning');
        }

      } catch (err: any) {
        if (!isMounted) return;
        
        console.error('Failed to start scanner:', err);
        let errorMessage = 'No se pudo acceder a la cámara.';
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Permiso para acceder a la cámara denegado. Por favor, habilita el acceso en la configuración de tu navegador.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message === 'No video input devices found') {
          errorMessage = 'No se encontró ninguna cámara conectada.';
        }
        setError(errorMessage);
        setStatus('error');
      }
    };

    startScanner();

    return () => {
        isMounted = false;
        // Use the controls to stop the video stream and release the camera.
        if (controlsRef.current) {
            controlsRef.current.stop();
        }
        console.log('Barcode scanner cleanup.');
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[100]">
      <div className="absolute top-4 right-4">
        <button onClick={onClose} className="text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75">
          <IconX className="w-8 h-8" />
        </button>
      </div>

      <div className="relative w-full max-w-lg md:max-w-xl aspect-video rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" />
        
        {/* Scanner Overlay UI */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="w-full h-1/2 border-4 border-dashed border-white rounded-lg opacity-75"></div>
        </div>

        <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/60 to-transparent">
            <p className="text-white text-center font-semibold text-lg">Apunta al código de barras</p>
        </div>
      </div>

      <div className="mt-4 p-4 text-center">
        {status === 'loading' && <p className="text-white">Iniciando cámara...</p>}
        {status === 'error' && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md max-w-md">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
