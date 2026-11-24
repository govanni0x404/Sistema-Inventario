import { lazy, type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NegocioProvider } from "./context/NegocioContext";
import { SidebarProvider } from "./context/SidebarContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { navItems, tieneAcceso } from "./components/nav-data";
import RequireAuth from "./components/RequireAuth";
import RequireSeccion from "./components/RequireSeccion";
import RequireAdmin from "./components/RequireAdmin";
import AccessDenied from "./components/AccessDenied";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProductosPage = lazy(() => import("./pages/ProductosPage"));
const StockPage = lazy(() => import("./pages/StockPage"));
const MovimientosPage = lazy(() => import("./pages/MovimientosPage"));
const PreciosPage = lazy(() => import("./pages/PreciosPage"));
const ClientesPage = lazy(() => import("./pages/ClientesPage"));
const ProveedoresPage = lazy(() => import("./pages/ProveedoresPage"));
const CajaPage = lazy(() => import("./pages/CajaPage"));
const ControlCajasPage = lazy(() => import("./pages/ControlCajasPage"));
const TurnosPage = lazy(() => import("./pages/TurnosPage"));
const HistorialPage = lazy(() => import("./pages/HistorialPage"));
const PermisosPage = lazy(() => import("./pages/PermisosPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const CategoriasPage = lazy(() => import("./pages/CategoriasPage"));
const UnidadesPage = lazy(() => import("./pages/UnidadesPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const ListasPrecioPage = lazy(() => import("./pages/ListasPrecioPage"));
const ConsultasPage = lazy(() => import("./pages/ConsultasPage"));
const BodegasPage = lazy(() => import("./pages/BodegasPage"));
const TomaInventarioPage = lazy(() => import("./pages/TomaInventarioPage"));
const AuditoriaPage = lazy(() => import("./pages/AuditoriaPage"));
const NegocioPage = lazy(() => import("./pages/NegocioPage"));

const pages = {
  "/dashboard": <DashboardPage />,
  "/caja": <CajaPage />,
  "/control-cajas": <ControlCajasPage />,
  "/turnos": <TurnosPage />,
  "/productos": <ProductosPage />,
  "/stock": <StockPage />,
  "/bodega": <MovimientosPage />,
  "/bodegas": <BodegasPage />,
  "/toma-inventario": <TomaInventarioPage />,
  "/precios": <PreciosPage />,
  "/listas-precio": <ListasPrecioPage />,
  "/clientes": <ClientesPage />,
  "/proveedores": <ProveedoresPage />,
  "/historial": <HistorialPage />,
  "/consultas": <ConsultasPage />,
  "/permisos": <PermisosPage />,
  "/usuarios": <UsuariosPage />,
  "/categorias": <CategoriasPage />,
  "/unidades": <UnidadesPage />,
  "/roles": <RolesPage />,
  "/negocio": <NegocioPage />,
  "/auditoria": <AuditoriaPage />,
} satisfies Record<(typeof navItems)[number]["to"], ReactElement>;

function Inicio() {
  const { usuario } = useAuth();
  const pagina = navItems.find((item) => tieneAcceso(usuario, item));
  return pagina ? <Navigate to={pagina.to} replace /> : <AccessDenied />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NegocioProvider>
          <SidebarProvider>
            <TooltipProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/configuracion-inicial" element={<Navigate to="/login" replace />} />
                <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                  <Route index element={<Inicio />} />
                  {navItems.map((item) => (
                    <Route
                      key={item.to}
                      path={item.to}
                      element={"adminOnly" in item
                        ? <RequireAdmin>{pages[item.to]}</RequireAdmin>
                        : <RequireSeccion seccion={item.seccion}>{pages[item.to]}</RequireSeccion>}
                    />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </TooltipProvider>
          </SidebarProvider>
        </NegocioProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
