import { api } from "./client";
import type { MovimientoStock, MovimientoInput } from "../types/movimiento";

export const movimientosApi = {
  listar: (productoId: string) => api.get<MovimientoStock[]>(`/productos/${productoId}/movimientos`),
  crear: (productoId: string, data: MovimientoInput) =>
    api.post<MovimientoStock>(`/productos/${productoId}/movimientos`, data),
};
