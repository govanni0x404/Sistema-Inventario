import {
  LayoutDashboard, ShoppingCart, Clock, Package, Boxes, ArrowLeftRight, Tag, Users, Truck, Receipt,
  ShieldCheck, Users2, Tags, IdCard, ListTree, LineChart, Warehouse, History, Store, Ruler, Settings2, Wrench, ClipboardCheck, Banknote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Seccion, Usuario } from "@/types/auth";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
} & ({ seccion: Seccion } | { adminOnly: true });

export const navGroups = [
  {
    label: "General",
    icon: LayoutDashboard,
    items: [
      { to: "/dashboard", seccion: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/caja", seccion: "caja", label: "Caja", icon: ShoppingCart },
    ],
  },
  {
    label: "Consultas",
    icon: LineChart,
    items: [
      { to: "/historial", seccion: "historial", label: "Historial de ventas", icon: Receipt },
      { to: "/consultas", seccion: "consultas", label: "Reportes", icon: LineChart },
      { to: "/auditoria", adminOnly: true, label: "Auditoría", icon: History },
    ],
  },
  {
    label: "Inventario",
    icon: Boxes,
    items: [
      { to: "/stock", seccion: "stock", label: "Stock", icon: Boxes },
      { to: "/bodega", seccion: "bodega", label: "Entradas y salidas", icon: ArrowLeftRight },
      { to: "/bodegas", seccion: "bodega", label: "Bodegas", icon: Warehouse },
      { to: "/toma-inventario", seccion: "bodega", label: "Toma y ajuste de stock", icon: ClipboardCheck },
    ],
  },
  {
    label: "Mantención",
    icon: Settings2,
    items: [
      { to: "/productos", seccion: "productos", label: "Productos", icon: Package },
      { to: "/precios", seccion: "precios", label: "Precios", icon: Tag },
      { to: "/listas-precio", seccion: "precios", label: "Listas de precios", icon: ListTree },
      { to: "/clientes", seccion: "clientes", label: "Clientes", icon: Users },
      { to: "/proveedores", seccion: "proveedores", label: "Proveedores", icon: Truck },
      { to: "/categorias", adminOnly: true, label: "Categorías", icon: Tags },
      { to: "/unidades", adminOnly: true, label: "Unidades", icon: Ruler },
      { to: "/turnos", seccion: "turnos", label: "Turnos", icon: Clock },
      { to: "/negocio", adminOnly: true, label: "Datos del negocio", icon: Store },
    ],
  },
  {
    label: "Herramientas",
    icon: Wrench,
    items: [
      { to: "/control-cajas", adminOnly: true, label: "Control de cajas", icon: Banknote },
      { to: "/permisos", adminOnly: true, label: "Permisos", icon: ShieldCheck },
      { to: "/roles", adminOnly: true, label: "Roles", icon: IdCard },
      { to: "/usuarios", adminOnly: true, label: "Usuarios", icon: Users2 },
    ],
  },
] as const satisfies readonly { label: string; icon: LucideIcon; items: readonly NavItem[] }[];

export const navItems = navGroups.flatMap(({ label, items }) => items.map((item) => ({ ...item, group: label })));

export function tieneAcceso(usuario: Usuario | null, regla: { seccion: Seccion } | { adminOnly: true }) {
  return !!usuario && (usuario.rol === "admin" || ("seccion" in regla && usuario.permisos[regla.seccion] !== false));
}
