import { api } from "./client";
import type { MovimientoStock, MovimientoInput, MovimientoKardex } from "../types/movimiento";

export const movimientosApi = {
  listar: (productoId: string) => api.get<MovimientoStock[]>(`/productos/${productoId}/movimientos`),
  crear: (productoId: string, data: MovimientoInput) =>
    api.post<MovimientoStock>(`/productos/${productoId}/movimientos`, data),
  kardex: (params: URLSearchParams) =>
    api.get<{ total: number; entradas: number; salidas: number; porPagina: number; filas: MovimientoKardex[]; valorMermas?: string }>(`/bodegas/kardex?${params}`),
  exportarKardex: (params: URLSearchParams) =>
    api.get<MovimientoKardex[]>(`/bodegas/kardex?${new URLSearchParams([...params, ["exportar", "true"]])}`),
};
