import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import Stock from './pages/Stock';
import StockInsumos from './pages/StockInsumos';
import Clientes from './pages/Clientes';
import Ventas from './pages/Ventas';
import Precios from './pages/Precios';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AppRole } from './types';
import ProductoDashboard from './pages/ProductoDashboard';
import GestionUsuarios from './pages/GestionUsuarios';
import CrearVenta from './pages/CrearVenta';
import GestionListasPrecios from './pages/GestionListasPrecios';
import GestionDepositos from './pages/GestionDepositos';
import TransferenciasStock from './pages/TransferenciasStock';
import PublicPriceListPage from './pages/PublicPriceListPage';
import ClientPriceListPage from './pages/ClientPriceListPage';
import Comex from './pages/Comex';
import ComexRequestPage from './pages/ComexRequestPage';
import ComexPendingPage from './pages/ComexPendingPage';
import EstadisticasProductos from './pages/EstadisticasProductos';

// Define roles for each route for clarity
const routeConfig: { path: string; component: React.ReactElement; roles: AppRole[] }[] = [
    { path: '/', component: <Dashboard />, roles: ['superadmin', 'vendedor', 'administrativo', 'analitico'] },
    { path: '/estadisticas-productos', component: <EstadisticasProductos />, roles: ['superadmin', 'analitico'] },
    { path: '/ventas', component: <Ventas />, roles: ['superadmin', 'vendedor', 'analitico'] },
    { path: '/productos', component: <Productos />, roles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
    { path: '/stock/productos', component: <Stock />, roles: ['superadmin', 'administrativo'] },
    { path: '/stock/insumos', component: <StockInsumos />, roles: ['superadmin', 'administrativo'] },
    { path: '/stock/depositos', component: <GestionDepositos />, roles: ['superadmin', 'administrativo'] },
    { path: '/stock/transferencias', component: <TransferenciasStock />, roles: ['superadmin', 'administrativo'] },
    { path: '/clientes', component: <Clientes />, roles: ['superadmin', 'vendedor', 'analitico'] },
    { path: '/precios', component: <Precios />, roles: ['superadmin', 'administrativo', 'vendedor', 'analitico'] },
    { path: '/comex', component: <Comex />, roles: ['superadmin', 'comex'] },
    { path: '/gestion-usuarios', component: <GestionUsuarios />, roles: ['superadmin'] },
    { path: '/gestion-listas-precios', component: <GestionListasPrecios />, roles: ['superadmin'] },
];

const App: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Cargando ERP...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lista-publica" element={<PublicPriceListPage />} />
          <Route path="/solicitud-comex" element={<ComexRequestPage />} />
          <Route path="*" element={<Navigate to="/lista-publica" />} />
        </Routes>
      </HashRouter>
    );
  }

  // COMEX Pending view
  if (profile?.roles?.includes('comex_pending')) {
    return (
        <HashRouter>
            <div className="flex h-screen bg-gray-100 font-sans">
                {/* No sidebar for pending users */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header onMenuClick={() => {}} />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6 md:p-8">
                        <Routes>
                            <Route path="/espera-aprobacion" element={<ComexPendingPage />} />
                            <Route path="*" element={<Navigate to="/espera-aprobacion" />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </HashRouter>
    );
  }

  // Client-specific view
  if (profile?.roles?.includes('cliente')) {
    return (
      <HashRouter>
        <Routes>
           <Route
              path="/mi-lista"
              element={
                <ProtectedRoute allowedRoles={['cliente']}>
                  <ClientPriceListPage />
                </ProtectedRoute>
              }
            />
          <Route path="*" element={<Navigate to="/mi-lista" />} />
        </Routes>
      </HashRouter>
    );
  }
  
    // COMEX client view
  if (profile?.roles?.includes('comex') && !profile.roles.includes('superadmin')) {
    return (
      <HashRouter>
          <div className="flex h-screen bg-gray-100 font-sans">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6 md:p-8">
                    <Routes>
                        <Route
                            path="/comex"
                            element={
                                <ProtectedRoute allowedRoles={['comex']}>
                                    <Comex />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="*" element={<Navigate to="/comex" />} />
                    </Routes>
                </main>
            </div>
        </div>
      </HashRouter>
    );
  }


  // Main ERP view for other roles
  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-100 font-sans">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6 md:p-8">
            <Routes>
              {routeConfig.map(({ path, component, roles }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <ProtectedRoute allowedRoles={roles}>
                      {component}
                    </ProtectedRoute>
                  }
                />
              ))}
              <Route
                  path="/productos/:productoId/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['superadmin', 'administrativo', 'analitico']}>
                      <ProductoDashboard />
                    </ProtectedRoute>
                  }
                />
                 <Route
                  path="/ventas/crear"
                  element={
                    <ProtectedRoute allowedRoles={['superadmin', 'vendedor']}>
                      <CrearVenta />
                    </ProtectedRoute>
                  }
                />
              <Route path="/lista-publica" element={<PublicPriceListPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
