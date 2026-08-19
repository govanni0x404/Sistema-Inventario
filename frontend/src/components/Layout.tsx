import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Users,
  Truck,
  Receipt,
  AlertTriangle,
  Boxes,
  Tag,
  ArrowLeftRight,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productosApi } from "../api/productos";
import { useAuth } from "../context/AuthContext";
import type { Seccion } from "../types/auth";

const tabs: { to: string; seccion: Seccion; label: string; icon: LucideIcon }[] = [
  { to: "/caja", seccion: "caja", label: "Caja", icon: ShoppingCart },
  { to: "/productos", seccion: "productos", label: "Productos", icon: Package },
  { to: "/stock", seccion: "stock", label: "Stock", icon: Boxes },
  { to: "/bodega", seccion: "bodega", label: "Bodega", icon: ArrowLeftRight },
  { to: "/precios", seccion: "precios", label: "Precios", icon: Tag },
  { to: "/clientes", seccion: "clientes", label: "Clientes", icon: Users },
  { to: "/proveedores", seccion: "proveedores", label: "Proveedores", icon: Truck },
  { to: "/historial", seccion: "historial", label: "Historial", icon: Receipt },
];

const permisosTab = { to: "/permisos", label: "Permisos", icon: ShieldCheck };

function NavItem({ to, label, icon: Icon, vertical }: { to: string; label: string; icon: LucideIcon; vertical?: boolean }) {
  const base = vertical
    ? "flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl font-body text-sm font-medium transition-colors text-left"
    : "flex items-center gap-1.5 px-3.5 py-2 rounded-full font-body text-sm font-medium whitespace-nowrap transition-colors shrink-0";

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${base} ${
          vertical
            ? isActive
              ? "bg-accent-soft text-accent-dark"
              : "text-ink-soft hover:bg-accent-soft/50"
            : isActive
              ? "bg-accent text-white"
              : "text-ink-soft"
        }`
      }
    >
      <Icon size={vertical ? 17 : 15} /> {label}
    </NavLink>
  );
}

export default function Layout() {
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const isCaja = location.pathname === "/caja";
  const [lowStockCount, setLowStockCount] = useState(0);

  const visibleTabs = useMemo(() => {
    const permitidas = tabs.filter((t) => usuario?.rol === "admin" || usuario?.permisos?.[t.seccion] !== false);
    return usuario?.rol === "admin" ? [...permitidas, permisosTab] : permitidas;
  }, [usuario]);

  const activo = visibleTabs.find((t) => t.to === location.pathname);

  useEffect(() => {
    productosApi
      .listarConStockBajo()
      .then((p) => setLowStockCount(p.length))
      .catch(() => setLowStockCount(0));
  }, [location.pathname]);

  return (
    <div className="min-h-screen font-body flex bg-bg">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border px-4 py-6">
        <h1 className="font-display text-xl font-bold px-1 mb-0.5 text-ink">Caja &amp; Inventario</h1>
        <p className="font-body text-xs px-1 mb-6 text-ink-soft">Sistema de inventario</p>
        <nav className="flex flex-col gap-1">
          {visibleTabs.map((t) => (
            <NavItem key={t.to} vertical {...t} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 font-body text-xs px-3 py-2 rounded-xl bg-warn-soft text-warn">
              <AlertTriangle size={13} /> {lowStockCount} producto{lowStockCount > 1 ? "s" : ""} con stock bajo
            </div>
          )}
          {usuario && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border">
              <div className="min-w-0 flex-1">
                <div className="font-body text-xs font-medium text-ink truncate">{usuario.nombre}</div>
                <div className="font-body text-[11px] text-ink-soft capitalize">{usuario.rol}</div>
              </div>
              <button onClick={logout} className="p-1.5 rounded-lg text-ink-soft hover:text-warn shrink-0" aria-label="Cerrar sesión">
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 sm:pt-9 pb-20">
          <div className="md:hidden flex items-center justify-between mb-1">
            <h1 className="font-display text-2xl font-bold text-ink">Caja &amp; Inventario</h1>
            <div className="flex items-center gap-2">
              {lowStockCount > 0 && (
                <div className="flex items-center gap-1 font-body text-xs px-2.5 py-1 rounded-full shrink-0 bg-warn-soft text-warn">
                  <AlertTriangle size={12} /> {lowStockCount}
                </div>
              )}
              <button onClick={logout} className="p-1.5 rounded-lg text-ink-soft" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-1 mb-4 mt-4">
            {visibleTabs.map((t) => (
              <NavItem key={t.to} {...t} />
            ))}
          </div>

          <h2 className="hidden md:block font-display text-2xl font-bold mb-6 text-ink">{activo?.label}</h2>

          <div className={isCaja ? "" : "rounded-2xl p-5 sm:p-7 bg-surface border border-border"}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
