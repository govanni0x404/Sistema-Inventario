import { api } from "./client";
import type { Venta, VentaInput, Devolucion, DevolucionInput } from "../types/venta";

export const ventasApi = {
  listar: (params?: {
    fecha?: string;
    desde?: string;
    hasta?: string;
    clienteId?: string;
    metodoPago?: string;
    turnoCajaId?: string;
    limite?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.fecha) qs.set("fecha", params.fecha);
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    if (params?.clienteId) qs.set("clienteId", params.clienteId);
    if (params?.metodoPago) qs.set("metodoPago", params.metodoPago);
    if (params?.turnoCajaId) qs.set("turnoCajaId", params.turnoCajaId);
    if (params?.limite) qs.set("limite", String(params.limite));
    const query = qs.toString();
    return api.get<Venta[]>(`/ventas${query ? `?${query}` : ""}`);
  },
  obtener: (id: string) => api.get<Venta>(`/ventas/${id}`),
  crear: (data: VentaInput) => api.post<Venta>("/ventas", data),
  devolver: (id: string, data: DevolucionInput) => api.post<Devolucion>(`/ventas/${id}/devolucion`, data),
};
