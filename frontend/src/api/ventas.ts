import { api } from "./client";
import type { Venta, VentaInput } from "../types/venta";

export const ventasApi = {
  listar: (params?: { fecha?: string; clienteId?: string; metodoPago?: string }) => {
    const qs = new URLSearchParams();
    if (params?.fecha) qs.set("fecha", params.fecha);
    if (params?.clienteId) qs.set("clienteId", params.clienteId);
    if (params?.metodoPago) qs.set("metodoPago", params.metodoPago);
    const query = qs.toString();
    return api.get<Venta[]>(`/ventas${query ? `?${query}` : ""}`);
  },
  obtener: (id: string) => api.get<Venta>(`/ventas/${id}`),
  crear: (data: VentaInput) => api.post<Venta>("/ventas", data),
};
