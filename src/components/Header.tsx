import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IconMenu2 } from '@/components/Icons';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, profile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // No need to navigate, the AuthProvider will handle the state change
    // and App.tsx will re-render to show the login page.
  };

  const displayRoles = profile?.roles?.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ');

  return (
    <header className="flex items-center justify-between p-4 bg-surface border-b">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 focus:outline-none"
      >
        <IconMenu2 className="h-6 w-6" />
      </button>
      <div className="flex-1"></div> {/* Spacer */}
      <div className="flex items-center space-x-4">
        <div className="text-right hidden sm:block">
            <span className="text-sm text-gray-700 font-semibold">
              {user?.email}
            </span>
            <span className="text-xs text-gray-500 block capitalize">
              {displayRoles}
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

export default Header;