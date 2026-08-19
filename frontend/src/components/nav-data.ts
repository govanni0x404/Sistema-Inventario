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
      { to: "/historial", seccion: "historial", label: "Historial", icon: Receipt },
    ],
  },
  {
    label: "Inventario",
    items: [
      { to: "/productos", seccion: "productos", label: "Productos", icon: Package },
      { to: "/stock", seccion: "stock", label: "Stock", icon: Boxes },
      { to: "/bodega", seccion: "bodega", label: "Bodega", icon: ArrowLeftRight },
      { to: "/precios", seccion: "precios", label: "Precios", icon: Tag },
    ],
  },
  {
    label: "Contactos",
    items: [
      { to: "/clientes", seccion: "clientes", label: "Clientes", icon: Users },
      { to: "/proveedores", seccion: "proveedores", label: "Proveedores", icon: Truck },
    ],
  },
];

export const adminNavItem: NavItem = {
  to: "/permisos",
  seccion: "caja", // no aplica: el acceso real se resuelve por rol, no por permisos de sección
  label: "Permisos",
  icon: ShieldCheck,
};
