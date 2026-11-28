import {
  LayoutDashboard, ShoppingCart, Clock, Package, Boxes, ArrowLeftRight, Tag, Users, Truck, Receipt, ClipboardList, PackageSearch,
  ShieldCheck, Users2, Tags, IdCard, ListTree, LineChart, Warehouse, History, Ruler, Settings2, Wrench, ClipboardCheck, Banknote, TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Seccion, Usuario } from "@/types/auth";

type NavItem = {
  to: string;
  label: string;
  /** Frase corta que acompaña el título de la página. */
  description: string;
  icon: LucideIcon;
} & ({ seccion: Seccion } | { adminOnly: true });

export const navGroups = [
  {
    label: "General",
    icon: LayoutDashboard,
    items: [
      { to: "/dashboard", seccion: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Resumen de ventas, inventario y actividad del negocio." },
      { to: "/caja", seccion: "caja", label: "Caja", icon: ShoppingCart, description: "Registra ventas y cobra a tus clientes." },
      { to: "/cotizaciones", seccion: "caja", label: "Cotizaciones", icon: ClipboardList, description: "Consulta propuestas para clientes, su vigencia y las ventas vinculadas." },
    ],
  },
  {
    label: "Consultas",
    icon: LineChart,
    items: [
      { to: "/historial", seccion: "historial", label: "Historial de ventas", icon: Receipt, description: "Revisa, reimprime y gestiona las ventas realizadas." },
      { to: "/consultas", seccion: "consultas", label: "Reportes", icon: LineChart, description: "Analiza ventas, productos y movimientos por período." },
      { to: "/auditoria", adminOnly: true, label: "Auditoría", icon: History, description: "Registro de acciones realizadas en el sistema." },
    ],
  },
  {
    label: "Inventario",
    icon: Boxes,
    items: [
      { to: "/stock", seccion: "stock", label: "Stock", icon: Boxes, description: "Existencias actuales por producto y bodega." },
      { to: "/planificacion", seccion: "planificacion", label: "Reposición y valorización", icon: PackageSearch, description: "Controla mínimos, compras pendientes y el valor de las existencias por bodega." },
      { to: "/compras", seccion: "compras", label: "Compras", icon: ClipboardList, description: "Gestiona órdenes, recepciones y devoluciones a proveedores." },
      { to: "/bodega", seccion: "bodega", label: "Entradas y salidas", icon: ArrowLeftRight, description: "Registra entradas, salidas y traspasos de mercadería." },
      { to: "/mermas", seccion: "bodega", label: "Mermas", icon: TriangleAlert, description: "Registra pérdidas por bodega y consulta su costo en el kárdex." },
      { to: "/kardex", seccion: "bodega", label: "Kárdex", icon: History, description: "Consulta y exporta los movimientos de inventario por período, bodega y origen." },
      { to: "/bodegas", seccion: "bodega", label: "Bodegas", icon: Warehouse, description: "Administra las bodegas y locales del negocio." },
      { to: "/toma-inventario", seccion: "bodega", label: "Toma y ajuste de stock", icon: ClipboardCheck, description: "Cuenta el inventario físico y ajusta diferencias." },
    ],
  },
  {
    label: "Mantención",
    icon: Settings2,
    items: [
      { to: "/productos", seccion: "productos", label: "Productos", icon: Package, description: "Crea y organiza el catálogo de productos." },
      { to: "/precios", seccion: "precios", label: "Precios", icon: Tag, description: "Define precios de venta y costos." },
      { to: "/listas-precio", seccion: "precios", label: "Listas de precios", icon: ListTree, description: "Precios especiales para grupos de clientes." },
      { to: "/clientes", seccion: "clientes", label: "Clientes", icon: Users, description: "Datos de contacto y condiciones de tus clientes." },
      { to: "/proveedores", seccion: "proveedores", label: "Proveedores", icon: Truck, description: "Administra a quienes te abastecen." },
      { to: "/categorias", adminOnly: true, label: "Categorías", icon: Tags, description: "Agrupa los productos por categoría." },
      { to: "/unidades", adminOnly: true, label: "Unidades", icon: Ruler, description: "Unidades de medida para vender y comprar." },
      { to: "/turnos", seccion: "turnos", label: "Turnos", icon: Clock, description: "Tipos de turno y horarios de caja." },
    ],
  },
  {
    label: "Herramientas",
    icon: Wrench,
    items: [
      { to: "/negocio", adminOnly: true, label: "Configuración", icon: Settings2, description: "Datos del negocio y reglas de la caja." },
      { to: "/control-cajas", adminOnly: true, label: "Control de cajas", icon: Banknote, description: "Supervisa turnos, arqueos y movimientos de caja." },
      { to: "/permisos", adminOnly: true, label: "Permisos", icon: ShieldCheck, description: "Define qué secciones puede ver cada rol." },
      { to: "/roles", adminOnly: true, label: "Roles", icon: IdCard, description: "Crea y edita los roles del equipo." },
      { to: "/usuarios", adminOnly: true, label: "Usuarios", icon: Users2, description: "Gestiona las cuentas de acceso al sistema." },
    ],
  },
] as const satisfies readonly { label: string; icon: LucideIcon; items: readonly NavItem[] }[];

export const navItems = navGroups.flatMap(({ label, items }) => items.map((item) => ({ ...item, group: label })));

export function tieneAcceso(usuario: Usuario | null, regla: { seccion: Seccion } | { adminOnly: true }) {
  return !!usuario && (usuario.rol === "admin" || ("seccion" in regla && usuario.permisos[regla.seccion] !== false));
}
