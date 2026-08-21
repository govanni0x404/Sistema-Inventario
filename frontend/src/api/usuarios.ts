import { api } from "./client";
import type { UsuarioAdmin, UsuarioInput, UsuarioUpdateInput } from "../types/usuario";

export const usuariosApi = {
  listar: () => api.get<UsuarioAdmin[]>("/usuarios"),
  crear: (data: UsuarioInput) => api.post<UsuarioAdmin>("/usuarios", data),
  actualizar: (id: string, data: UsuarioUpdateInput) => api.put<UsuarioAdmin>(`/usuarios/${id}`, data),
  resetPassword: (id: string, password: string) => api.put<{ ok: boolean }>(`/usuarios/${id}/password`, { password }),
};
