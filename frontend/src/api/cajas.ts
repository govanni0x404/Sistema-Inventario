import { api } from "./client";
import type { Caja, CajaInput } from "@/types/turno";

export const cajasApi = {
  listar: (todas = false) => api.get<Caja[]>(todas ? "/cajas?todas=true" : "/cajas"),
  guardar: (data: CajaInput, id?: string) => id ? api.put<Caja>(`/cajas/${id}`, data) : api.post<Caja>("/cajas", data),
};
