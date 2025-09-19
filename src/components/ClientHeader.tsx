
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ClientHeaderProps {
    listName?: string;
}

const ClientHeader: React.FC<ClientHeaderProps> = ({ listName }) => {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
    };

    return (
        <header className="flex items-center justify-between p-4 bg-surface shadow-md">
            <div>
                <h1 className="text-xl font-bold text-primary">Isabella de la Perla</h1>
                <p className="text-sm text-gray-600">Portal de Clientes</p>
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                    <span className="text-sm text-gray-700 font-semibold">
                        {user?.email}
                    </span>
                    <span className="text-xs text-primary font-semibold block capitalize">
                        {listName || 'Lista de Precios General'}
                    </span>
                </div>
                <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 hover:text-primary transition-colors"
                >
                    Salir
                </button>
            </div>
        </header>
    );
};

export default ClientHeader;
