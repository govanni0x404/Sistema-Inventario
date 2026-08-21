import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import RequireAuth from "./components/RequireAuth";
import RequireSeccion from "./components/RequireSeccion";
import RequireAdmin from "./components/RequireAdmin";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductosPage from "./pages/ProductosPage";
import StockPage from "./pages/StockPage";
import MovimientosPage from "./pages/MovimientosPage";
import PreciosPage from "./pages/PreciosPage";
import ClientesPage from "./pages/ClientesPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import CajaPage from "./pages/CajaPage";
import TurnosPage from "./pages/TurnosPage";
import HistorialPage from "./pages/HistorialPage";
import PermisosPage from "./pages/PermisosPage";
import UsuariosPage from "./pages/UsuariosPage";
import CategoriasPage from "./pages/CategoriasPage";
import RolesPage from "./pages/RolesPage";
import ListasPrecioPage from "./pages/ListasPrecioPage";
import ConsultasPage from "./pages/ConsultasPage";
import BodegasPage from "./pages/BodegasPage";
import AuditoriaPage from "./pages/AuditoriaPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SidebarProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <RequireSeccion seccion="dashboard">
                  <DashboardPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/caja"
              element={
                <RequireSeccion seccion="caja">
                  <CajaPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/turnos"
              element={
                <RequireSeccion seccion="turnos">
                  <TurnosPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/productos"
              element={
                <RequireSeccion seccion="productos">
                  <ProductosPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/stock"
              element={
                <RequireSeccion seccion="stock">
                  <StockPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/bodega"
              element={
                <RequireSeccion seccion="bodega">
                  <MovimientosPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/bodegas"
              element={
                <RequireSeccion seccion="bodega">
                  <BodegasPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/precios"
              element={
                <RequireSeccion seccion="precios">
                  <PreciosPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/listas-precio"
              element={
                <RequireSeccion seccion="precios">
                  <ListasPrecioPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/clientes"
              element={
                <RequireSeccion seccion="clientes">
                  <ClientesPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/proveedores"
              element={
                <RequireSeccion seccion="proveedores">
                  <ProveedoresPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/historial"
              element={
                <RequireSeccion seccion="historial">
                  <HistorialPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/consultas"
              element={
                <RequireSeccion seccion="consultas">
                  <ConsultasPage />
                </RequireSeccion>
              }
            />
            <Route
              path="/permisos"
              element={
                <RequireAdmin>
                  <PermisosPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/usuarios"
              element={
                <RequireAdmin>
                  <UsuariosPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/categorias"
              element={
                <RequireAdmin>
                  <CategoriasPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/roles"
              element={
                <RequireAdmin>
                  <RolesPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/auditoria"
              element={
                <RequireAdmin>
                  <AuditoriaPage />
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        </SidebarProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
