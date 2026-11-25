import { lazy, type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NegocioProvider } from "./context/NegocioContext";
import { SidebarProvider } from "./context/SidebarContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { navItems, tieneAcceso } from "./components/nav-data";
import RequireAuth from "./components/RequireAuth";
import RequireSeccion from "./components/RequireSeccion";
import RequireAdmin from "./components/RequireAdmin";
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

function DashboardInicio() {
  const { usuario } = useAuth();
  if (tieneAcceso(usuario, { seccion: "dashboard" })) return <DashboardPage />;

  const accesos = navItems.filter((item) => tieneAcceso(usuario, item));
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {accesos.length ? "Elige una sección disponible para tu rol." : "Pide a un administrador que habilite las secciones para tu rol."}
      </p>
      {accesos.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium hover:bg-accent">
                <Icon size={18} aria-hidden="true" /> {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  {navItems.map((item) => (
                    <Route
                      key={item.to}
                      path={item.to}
                      element={item.to === "/dashboard" ? <DashboardInicio /> : "adminOnly" in item
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
