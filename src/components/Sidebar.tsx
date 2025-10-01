import React, { Dispatch, SetStateAction } from 'react';
import { NavLink } from 'react-router-dom';
import { IconChartPie, IconShoppingCart, IconPackage, IconUsers, IconTag, IconBuildingWarehouse, IconUserCog, IconX, IconCashBanknote, IconBuilding, IconSwitchHorizontal, IconFileText, IconWorld, IconChartBar } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { AppRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

interface NavLinkConfig {
    type: 'link';
    to: string;
    text: string;
    icon: React.ReactNode;
    allowedRoles: AppRole[];
}

interface NavHeaderConfig {
    type: 'header';
    text: string;
    allowedRoles: AppRole[]; 
}

type NavConfigItem = NavLinkConfig | NavHeaderConfig;

const navConfig: NavConfigItem[] = [
  { type: 'link', to: '/', text: 'Dashboard', icon: <IconChartPie className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'administrativo', 'analitico'] },
  { type: 'link', to: '/ventas', text: 'Ventas', icon: <IconShoppingCart className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'analitico'] },
  { type: 'link', to: '/clientes', text: 'Clientes', icon: <IconUsers className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'analitico'] },
  
  { type: 'header', text: 'Catálogo', allowedRoles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
  { type: 'link', to: '/productos', text: 'Productos', icon: <IconPackage className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
  { type: 'link', to: '/precios', text: 'Listas de Precios', icon: <IconTag className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
  
  { type: 'header', text: 'Inventario', allowedRoles: ['superadmin', 'administrativo'] },
  { type: 'link', to: '/stock/productos', text: 'Stock Productos', icon: <IconPackage className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { type: 'link', to: '/stock/insumos', text: 'Stock Insumos', icon: <IconBuildingWarehouse className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { type: 'link', to: '/stock/depositos', text: 'Gestión Depósitos', icon: <IconBuilding className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { type: 'link', to: '/stock/transferencias', text: 'Transferencias', icon: <IconSwitchHorizontal className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },

  { type: 'header', text: 'Análisis', allowedRoles: ['superadmin', 'analitico', 'administrativo'] },
  { type: 'link', to: '/estadisticas-productos', text: 'Estadísticas Prod.', icon: <IconChartBar className="h-5 w-5" />, allowedRoles: ['superadmin', 'analitico', 'administrativo'] },

  { type: 'header', text: 'Administración', allowedRoles: ['superadmin', 'comex'] },
  { type: 'link', to: '/comex', text: 'COMEX', icon: <IconWorld className="h-5 w-5" />, allowedRoles: ['superadmin', 'comex'] },
  { type: 'link', to: '/gestion-listas-precios', text: 'Gestión Listas', icon: <IconCashBanknote className="h-5 w-5" />, allowedRoles: ['superadmin'] },
  { type: 'link', to: '/gestion-usuarios', text: 'Gestión Usuarios', icon: <IconUserCog className="h-5 w-5" />, allowedRoles: ['superadmin'] },
  
  { type: 'link', to: '/lista-publica', text: 'Vista Pública Precios', icon: <IconFileText className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'administrativo', 'analitico']},
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { profile } = useAuth();
  
  const userRoles = profile?.roles || [];
  
  const hasAccess = (allowedRoles: AppRole[]): boolean => {
      return userRoles.some(userRole => allowedRoles.includes(userRole));
  };
  
  const availableItems = navConfig.filter(item => hasAccess(item.allowedRoles));

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      ></div>
      <aside
        className={`flex flex-col w-64 bg-surface h-full shadow-lg fixed lg:static z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold text-primary">Isabella de la Perla</h1>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-500 hover:text-primary">
            <IconX className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <ul>
            {availableItems.map((item, index) => {
                if (item.type === 'header') {
                    // Don't render a header if it's the very first item or if the previous item was also a header
                    if (index === 0 || availableItems[index - 1]?.type === 'header') return null;
                    return (
                        <li key={`header-${index}`} className="px-3 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {item.text}
                        </li>
                    );
                }
                return (
                     <li key={item.to}>
                        <NavLink
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) =>
                            `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
                                isActive
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-600 hover:bg-violet-100 hover:text-primary'
                            }`
                            }
                        >
                            {item.icon}
                            <span className="ml-3 font-medium">{item.text}</span>
                        </NavLink>
                    </li>
                )
            })}
          </ul>
        </nav>
        <div className="p-4 border-t">
          <p className="text-xs text-center text-gray-500">&copy; 2024 ERP System</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;