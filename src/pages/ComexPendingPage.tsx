
import React from 'react';
import { IconClock } from '@/components/Icons';

const ComexPendingPage: React.FC = () => {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-surface rounded-lg shadow-md max-w-lg mx-auto">
                <IconClock className="h-16 w-16 mx-auto text-primary mb-4" />
                <h2 className="text-2xl font-bold text-on-surface mb-2">Acceso Pendiente de Aprobación</h2>
                <p className="text-gray-600">
                    Gracias por registrarte. Tu cuenta ha sido creada exitosamente.
                </p>
                <p className="text-gray-600 mt-2">
                    Un administrador está revisando tu solicitud de acceso a las herramientas de COMEX. Recibirás una notificación y tu dashboard se activará automáticamente una vez que tu solicitud sea aprobada.
                </p>
            </div>
        </div>
    );
};

export default ComexPendingPage;
