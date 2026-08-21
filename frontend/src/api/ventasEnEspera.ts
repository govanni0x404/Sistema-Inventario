import { api } from "./client";
import type { VentaEnEspera, VentaEnEsperaInput } from "../types/ventaEnEspera";

export const ventasEnEsperaApi = {
  listar: () => api.get<VentaEnEspera[]>("/ventas-en-espera"),
  crear: (data: VentaEnEsperaInput) => api.post<VentaEnEspera>("/ventas-en-espera", data),
  eliminar: (id: string) => api.delete<void>(`/ventas-en-espera/${id}`),
};
