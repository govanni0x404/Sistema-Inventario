import { api } from "./client";
import type { MovimientoCaja } from "../types/turno";

export type MovimientoCajaInput = { tipo: "retiro" | "ingreso"; monto: number; motivo: string };

export const movimientosCajaApi = {
  listarActual: () => api.get<MovimientoCaja[]>("/movimientos-caja"),
  crear: (data: MovimientoCajaInput) => api.post<MovimientoCaja>("/movimientos-caja", data),
};
