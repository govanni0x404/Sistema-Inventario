import { api } from "./client";
import type { Unidad, UnidadInput } from "../types/unidad";

export const unidadesApi = {
  listar: (activo?: boolean) => api.get<Unidad[]>(`/unidades${activo !== undefined ? `?activo=${activo}` : ""}`),
  crear: (data: UnidadInput) => api.post<Unidad>("/unidades", data),
  actualizar: (id: string, data: Partial<UnidadInput>) => api.put<Unidad>(`/unidades/${id}`, data),
  eliminar: (id: string) => api.delete<(Unidad & { _desactivado: true }) | undefined>(`/unidades/${id}`),
};
