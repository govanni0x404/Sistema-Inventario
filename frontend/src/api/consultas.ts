import { api } from "./client";
import type {
  ConsultaParams,
  ProductosTopResponse,
  VentasPorMetodoResponse,
  VentasPorUsuarioResponse,
} from "../types/consulta";

function qs(params?: ConsultaParams, extra?: Record<string, string | number>) {
  const q = new URLSearchParams();
  if (params?.desde && params?.hasta) {
    q.set("desde", params.desde);
    q.set("hasta", params.hasta);
  } else if (params?.dias) {
    q.set("dias", String(params.dias));
  }
  if (extra) for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
  const query = q.toString();
  return query ? `?${query}` : "";
}

export const consultasApi = {
  productosTop: (params?: ConsultaParams, limite?: number) =>
    api.get<ProductosTopResponse>(`/consultas/productos-top${qs(params, limite ? { limite } : undefined)}`),
  ventasPorMetodo: (params?: ConsultaParams) => api.get<VentasPorMetodoResponse>(`/consultas/ventas-por-metodo${qs(params)}`),
  ventasPorUsuario: (params?: ConsultaParams) => api.get<VentasPorUsuarioResponse>(`/consultas/ventas-por-usuario${qs(params)}`),
};
