import { api } from "./client";
import type { RolCatalogo, RolInput } from "../types/rol";

export const rolesApi = {
  listar: (activo?: boolean) => api.get<RolCatalogo[]>(`/roles${activo !== undefined ? `?activo=${activo}` : ""}`),
  crear: (data: RolInput) => api.post<RolCatalogo>("/roles", data),
  actualizar: (id: string, data: Partial<RolInput>) => api.put<RolCatalogo>(`/roles/${id}`, data),
  eliminar: (id: string) => api.delete<(RolCatalogo & { _desactivado: true }) | undefined>(`/roles/${id}`),
};
