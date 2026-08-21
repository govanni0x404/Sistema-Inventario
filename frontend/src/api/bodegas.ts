import { api } from "./client";
import type { Bodega, BodegaInput, StockBodegaItem, TransferenciaInput, TransferenciaResultado } from "../types/bodega";

export const bodegasApi = {
  listar: (activo?: boolean) => api.get<Bodega[]>(`/bodegas${activo !== undefined ? `?activo=${activo}` : ""}`),
  stock: (id: string) => api.get<StockBodegaItem[]>(`/bodegas/${id}/stock`),
  crear: (data: BodegaInput) => api.post<Bodega>("/bodegas", data),
  actualizar: (id: string, data: Partial<BodegaInput>) => api.put<Bodega>(`/bodegas/${id}`, data),
  eliminar: (id: string) => api.delete<void>(`/bodegas/${id}`),
  transferir: (data: TransferenciaInput) => api.post<TransferenciaResultado>("/bodegas/transferencias", data),
};
