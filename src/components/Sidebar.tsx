import React, { Dispatch, SetStateAction } from 'react';
import { NavLink } from 'react-router-dom';
import { IconChartPie, IconShoppingCart, IconPackage, IconUsers, IconTag, IconBuildingWarehouse, IconUserCog, IconX, IconCashBanknote, IconBuilding, IconSwitchHorizontal, IconFileText, IconWorld } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { AppRole } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

interface NavLinkConfig {
    to: string;
    text: string;
    icon: React.ReactNode;
    allowedRoles: AppRole[];
}

const navLinks: NavLinkConfig[] = [
  { to: '/', text: 'Dashboard', icon: <IconChartPie className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'administrativo', 'analitico'] },
  { to: '/ventas', text: 'Ventas', icon: <IconShoppingCart className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'analitico'] },
  { to: '/productos', text: 'Productos', icon: <IconPackage className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
  { to: '/stock/productos', text: 'Stock Productos', icon: <IconPackage className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { to: '/stock/insumos', text: 'Stock Insumos', icon: <IconBuildingWarehouse className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { to: '/stock/depositos', text: 'Gestión Depósitos', icon: <IconBuilding className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { to: '/stock/transferencias', text: 'Transferencias', icon: <IconSwitchHorizontal className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo'] },
  { to: '/clientes', text: 'Clientes', icon: <IconUsers className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'analitico'] },
  { to: '/precios', text: 'Listas de Precios', icon: <IconTag className="h-5 w-5" />, allowedRoles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
  { to: '/comex', text: 'COMEX', icon: <IconWorld className="h-5 w-5" />, allowedRoles: ['superadmin', 'comex'] },
  { to: '/lista-publica', text: 'Vista Pública Precios', icon: <IconFileText className="h-5 w-5" />, allowedRoles: ['superadmin', 'vendedor', 'administrativo', 'analitico']},
  { to: '/gestion-listas-precios', text: 'Gestión Listas', icon: <IconCashBanknote className="h-5 w-5" />, allowedRoles: ['superadmin'] },
  { to: '/gestion-usuarios', text: 'Gestión Usuarios', icon: <IconUserCog className="h-5 w-5" />, allowedRoles: ['superadmin'] },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { profile } = useAuth();
  
  const NavItem: React.FC<{ to: string; text: string; icon: React.ReactNode }> = ({ to, text, icon }) => (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        onClick={() => setIsOpen(false)}
        className={({ isActive }) =>
          `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
            isActive
              ? 'bg-primary text-white shadow-md'
              : 'text-gray-600 hover:bg-violet-100 hover:text-primary'
          }`
        }
      >
        {icon}
        <span className="ml-3 font-medium">{text}</span>
      </NavLink>
    </li>
  );

  const availableLinks = navLinks.filter(link => 
    profile && profile.roles && profile.roles.some(userRole => link.allowedRoles.includes(userRole))
  );

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
        <nav className="flex-1 px-4 py-4">
          <ul>
            {availableLinks.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
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
