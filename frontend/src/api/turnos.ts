import { api } from "./client";
import type { TurnoCaja, AbrirTurnoInput, CerrarTurnoInput } from "../types/turno";

export const turnosApi = {
  actual: () => api.get<TurnoCaja | null>("/turnos/actual"),
  listar: (params?: { estado?: string; desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set("estado", params.estado);
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    const query = qs.toString();
    return api.get<TurnoCaja[]>(`/turnos${query ? `?${query}` : ""}`);
  },
  obtener: (id: string) => api.get<TurnoCaja>(`/turnos/${id}`),
  abrir: (data: AbrirTurnoInput) => api.post<TurnoCaja>("/turnos", data),
  cerrar: (id: string, data: CerrarTurnoInput) => api.post<TurnoCaja>(`/turnos/${id}/cerrar`, data),
};
