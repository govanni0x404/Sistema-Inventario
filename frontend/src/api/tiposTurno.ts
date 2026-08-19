import { api } from "./client";
import type { TipoTurno, TipoTurnoInput } from "../types/turno";

export const tiposTurnoApi = {
  listar: (activo?: boolean) => api.get<TipoTurno[]>(`/tipos-turno${activo !== undefined ? `?activo=${activo}` : ""}`),
  crear: (data: TipoTurnoInput) => api.post<TipoTurno>("/tipos-turno", data),
  actualizar: (id: string, data: Partial<TipoTurnoInput>) => api.put<TipoTurno>(`/tipos-turno/${id}`, data),
  eliminar: (id: string) => api.delete<(TipoTurno & { _desactivado: true }) | undefined>(`/tipos-turno/${id}`),
};
