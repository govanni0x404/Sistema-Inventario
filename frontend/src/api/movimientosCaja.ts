import { api } from "./client";
import type { MovimientoCaja } from "../types/turno";

export type MovimientoCajaInput = { turnoCajaId: string; tipo: "retiro" | "ingreso"; monto: number; motivo: string };

export const movimientosCajaApi = {
  listarActual: (turnoCajaId: string) => api.get<MovimientoCaja[]>(`/movimientos-caja?turnoCajaId=${encodeURIComponent(turnoCajaId)}`),
  crear: (data: MovimientoCajaInput) => api.post<MovimientoCaja>("/movimientos-caja", data),
};
