import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import RequireSeccion from "./components/RequireSeccion";
import RequireAdmin from "./components/RequireAdmin";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import ProductosPage from "./pages/ProductosPage";
import StockPage from "./pages/StockPage";
import MovimientosPage from "./pages/MovimientosPage";
import PreciosPage from "./pages/PreciosPage";
import ClientesPage from "./pages/ClientesPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import CajaPage from "./pages/CajaPage";
import HistorialPage from "./pages/HistorialPage";
import PermisosPage from "./pages/PermisosPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/caja" replace />} />
            <Route
              path="/caja"
              element={
                <RequireSeccion seccion="caja">
                  <CajaPage />
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
              path="/precios"
              element={
                <RequireSeccion seccion="precios">
                  <PreciosPage />
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
              path="/permisos"
              element={
                <RequireAdmin>
                  <PermisosPage />
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="/caja" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
