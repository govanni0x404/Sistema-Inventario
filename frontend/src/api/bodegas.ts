import { api } from "./client";
import type { Bodega, BodegaInput, ResumenTomaInventario, StockBodegaItem, TomaInventario, TomaInventarioInput, TransferenciaInput, TransferenciaResultado } from "../types/bodega";

export const bodegasApi = {
  listar: (activo?: boolean) => api.get<Bodega[]>(`/bodegas${activo !== undefined ? `?activo=${activo}` : ""}`),
  stock: (id: string) => api.get<StockBodegaItem[]>(`/bodegas/${id}/stock`),
  crear: (data: BodegaInput) => api.post<Bodega>("/bodegas", data),
  actualizar: (id: string, data: Partial<BodegaInput>) => api.put<Bodega>(`/bodegas/${id}`, data),
  eliminar: (id: string) => api.delete<void>(`/bodegas/${id}`),
  transferir: (data: TransferenciaInput) => api.post<TransferenciaResultado>("/bodegas/transferencias", data),
  listarTomas: (id: string) => api.get<ResumenTomaInventario[]>(`/bodegas/${id}/tomas-inventario`),
  detalleToma: (id: string, tomaId: string) => api.get<TomaInventario>(`/bodegas/${id}/tomas-inventario/${tomaId}`),
  registrarToma: (id: string, data: TomaInventarioInput) => api.post<TomaInventario>(`/bodegas/${id}/tomas-inventario`, data),
};
