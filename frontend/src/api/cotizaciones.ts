import { api } from "./client";

export const estadosCotizacion = {
  vigente: "Vigente", vencida: "Vencida", anulada: "Anulada", vendida: "Vendida",
} as const;
export type EstadoCotizacion = keyof typeof estadosCotizacion;
export type LineaCotizacion = { productoId: string; cantidad: number; descuento: number; precio: number; gravado: boolean; nombre: string; codigo: string | null };
export interface Cotizacion {
  id: string;
  folio: number;
  clienteId: string;
  clienteNombre: string;
  fecha: string;
  vigenteHasta: string;
  estado: EstadoCotizacion;
  observaciones: string | null;
  usuarioNombre: string;
  descuento: number;
  total: number;
  items: LineaCotizacion[];
  venta: { id: string } | null;
}
export type CotizacionInput = {
  id: string;
  clienteId: string;
  listaPrecioId: string | null;
  vigenteHasta: string;
  observaciones: string;
  descuento: number;
  items: { productoId: string; cantidad: number; descuento: number }[];
};

export const cotizacionesApi = {
  listar: (query: URLSearchParams) =>
    api.get<{ total: number; porPagina: number; filas: Cotizacion[] }>(`/cotizaciones?${query}`),
  obtener: (id: string) => api.get<Cotizacion>(`/cotizaciones/${id}`),
  crear: (datos: CotizacionInput) => api.post<Cotizacion>("/cotizaciones", datos),
  anular: (id: string) => api.post<Cotizacion>(`/cotizaciones/${id}/anular`, {}),
};
