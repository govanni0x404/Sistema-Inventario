import { api } from "./client";
import type { Seccion } from "../types/auth";

export interface PermisosMatriz {
  roles: string[];
  secciones: Seccion[];
  permisos: Record<string, Record<Seccion, boolean>>;
}

export const permisosApi = {
  listar: () => api.get<PermisosMatriz>("/permisos"),
  actualizar: (cambios: { rol: string; seccion: Seccion; permitido: boolean }[]) =>
    api.put<PermisosMatriz>("/permisos", { cambios }),
};
