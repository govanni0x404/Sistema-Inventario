import { api } from "./client";
import { bodegasApi } from "./bodegas";
import { productosApi } from "./productos";
import { proveedoresApi } from "./proveedores";

export const estadosCompra = {
  borrador: "Borrador",
  emitida: "Emitida",
  parcial: "Recepción parcial",
  recibida: "Recibida",
  cerrada: "Cerrada con saldo",
  anulada: "Anulada",
} as const;

export type EstadoCompra = keyof typeof estadosCompra;
export type AccionCompra = "emitir" | "anular" | "cerrar";
export interface OrdenCompraInput {
  proveedorId: string;
  bodegaId: string;
  entregaEstimada: string | null;
  nota: string;
  items: { productoId: string; cantidad: number; costoUnitario: number }[];
}

export interface CompraItem {
  id: string;
  productoId: string;
  productoNombre: string;
  sku: string;
  cantidad: number;
  recibida: number;
  costoUnitario: string;
}

export interface OperacionCompraInput {
  id: string;
  recepcionId?: string;
  documento: string;
  nota: string;
  items: { itemId: string; cantidad: number }[];
}

export interface OperacionCompra extends Omit<OperacionCompraInput, "recepcionId" | "nota"> {
  recepcionId: string | null;
  nota: string | null;
  tipo: "recepcion" | "devolucion";
  usuarioNombre: string;
  fecha: string;
}

export interface OrdenCompra {
  id: string;
  folio: number;
  estado: EstadoCompra;
  proveedorId: string;
  proveedorNombre: string;
  bodegaId: string;
  bodegaNombre: string;
  entregaEstimada: string | null;
  nota: string | null;
  motivoCierre: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  items: CompraItem[];
}

export type DetalleCompra = OrdenCompra & { operaciones: OperacionCompra[] };
export type CompraSugerida = { productoId: string; bodegaId: string; proveedorId: string | null; cantidad: number };

export async function cargarCatalogoCompras() {
  const [productos, proveedores, bodegas] = await Promise.all([
    productosApi.listar(), proveedoresApi.listar(), bodegasApi.listar(),
  ]);
  return { productos: productos.filter((p) => p.activo && p.inventariable), proveedores, bodegas };
}

export type CatalogoCompras = Awaited<ReturnType<typeof cargarCatalogoCompras>>;

export function saldoRecepcion(orden: DetalleCompra, recepcion: OperacionCompra) {
  const saldo = new Map(recepcion.items.map((item) => [item.itemId, item.cantidad]));
  for (const op of orden.operaciones.filter((op) => op.recepcionId === recepcion.id)) {
    for (const item of op.items) saldo.set(item.itemId, (saldo.get(item.itemId) ?? 0) - item.cantidad);
  }
  return saldo;
}

export const comprasApi = {
  listar: (params: URLSearchParams) => api.get<{ total: number; porPagina: number; ordenes: OrdenCompra[] }>(`/compras?${params}`),
  obtener: (id: string) => api.get<DetalleCompra>(`/compras/${id}`),
  crear: (id: string, orden: OrdenCompraInput) => api.post<DetalleCompra>("/compras", { id, ...orden }),
  actualizar: (id: string, revision: string, orden: OrdenCompraInput) =>
    api.put<DetalleCompra>(`/compras/${id}`, { revision, ...orden }),
  cambiarEstado: (orden: DetalleCompra, accion: AccionCompra, motivo: string) =>
    api.post<DetalleCompra>(`/compras/${orden.id}/estado`, { accion, motivo, revision: orden.actualizadoEn }),
  registrar: (id: string, datos: OperacionCompraInput) =>
    api.post<DetalleCompra>(`/compras/${id}/operaciones`, datos),
};
