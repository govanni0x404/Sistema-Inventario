import {
  LayoutDashboard,
  ShoppingCart,
  Clock,
  Package,
  Boxes,
  ArrowLeftRight,
  Tag,
  Users,
  Truck,
  Receipt,
  ShieldCheck,
  Users2,
  Tags,
  IdCard,
  ListTree,
  LineChart,
  Warehouse,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Seccion } from "@/types/auth";

export type NavItem = {
  to: string;
  seccion: Seccion;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "General",
    items: [
      { to: "/dashboard", seccion: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/caja", seccion: "caja", label: "Caja", icon: ShoppingCart },
      { to: "/turnos", seccion: "turnos", label: "Turnos", icon: Clock },
    ],
  },
  {
    label: "Consultas",
    items: [
      { to: "/historial", seccion: "historial", label: "Historial", icon: Receipt },
      { to: "/stock", seccion: "stock", label: "Stock", icon: Boxes },
      { to: "/consultas", seccion: "consultas", label: "Reportes", icon: LineChart },
    ],
  },
  {
    label: "Mantención",
    items: [
      { to: "/productos", seccion: "productos", label: "Productos", icon: Package },
      { to: "/precios", seccion: "precios", label: "Precios", icon: Tag },
      { to: "/listas-precio", seccion: "precios", label: "Listas de precios", icon: ListTree },
      { to: "/clientes", seccion: "clientes", label: "Clientes", icon: Users },
      { to: "/proveedores", seccion: "proveedores", label: "Proveedores", icon: Truck },
      { to: "/bodega", seccion: "bodega", label: "Entradas y salidas", icon: ArrowLeftRight },
      { to: "/bodegas", seccion: "bodega", label: "Bodegas", icon: Warehouse },
    ],
  },
];

// Categorías vive dentro del catálogo de Mantención visualmente, pero su ruta sigue
// gateada por RequireAdmin (no por un permiso de sección) — así que no puede ir dentro
// de `navGroups` (eso se filtra por permiso, no por rol, y mostraría el link a
// cualquiera con acceso a "productos" aunque la ruta lo bloqueara igual). AppSidebarNav
// la inserta al final del grupo "Mantención" solo cuando el usuario es admin.
export const categoriasNavItem: NavItem = {
  to: "/categorias",
  seccion: "productos", // no aplica: el acceso real es RequireAdmin, no un permiso de sección
  label: "Categorías",
  icon: Tags,
};

export const adminNavItems: NavItem[] = [
  {
    to: "/usuarios",
    seccion: "caja", // no aplica: el acceso real se resuelve por rol, no por permisos de sección
    label: "Usuarios",
    icon: Users2,
  },
  {
    to: "/roles",
    seccion: "caja", // no aplica: el acceso real se resuelve por rol, no por permisos de sección
    label: "Roles",
    icon: IdCard,
  },
  {
    to: "/permisos",
    seccion: "caja", // no aplica: el acceso real se resuelve por rol, no por permisos de sección
    label: "Permisos",
    icon: ShieldCheck,
  },
  {
    to: "/auditoria",
    seccion: "caja", // no aplica: el acceso real se resuelve por rol, no por permisos de sección
    label: "Auditoría",
    icon: History,
  },
];
