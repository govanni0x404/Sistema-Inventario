import { api } from "./client";
import type { Categoria, CategoriaInput } from "../types/categoria";

export const categoriasApi = {
  listar: (activo?: boolean) => api.get<Categoria[]>(`/categorias${activo !== undefined ? `?activo=${activo}` : ""}`),
  crear: (data: CategoriaInput) => api.post<Categoria>("/categorias", data),
  actualizar: (id: string, data: Partial<CategoriaInput>) => api.put<Categoria>(`/categorias/${id}`, data),
  eliminar: (id: string) => api.delete<(Categoria & { _desactivado: true }) | undefined>(`/categorias/${id}`),
};
