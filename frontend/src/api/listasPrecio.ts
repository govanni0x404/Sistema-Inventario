import { api } from "./client";
import type { HistorialPrecioLista, ListaPrecio, ListaPrecioInput, ListaPrecioUpdateInput, PrecioLista } from "../types/listaPrecio";

export const listasPrecioApi = {
  listar: (activo?: boolean) => api.get<ListaPrecio[]>(`/listas-precio${activo !== undefined ? `?activo=${activo}` : ""}`),
  crear: (data: ListaPrecioInput) => api.post<ListaPrecio>("/listas-precio", data),
  actualizar: (id: string, data: ListaPrecioUpdateInput) => api.put<ListaPrecio>(`/listas-precio/${id}`, data),
  eliminar: (id: string) => api.delete<(ListaPrecio & { _desactivado: true }) | undefined>(`/listas-precio/${id}`),
  precios: (id: string) => api.get<PrecioLista[]>(`/listas-precio/${id}/precios`),
  guardarPrecio: (id: string, productoId: string, precio: number) =>
    api.put<PrecioLista>(`/listas-precio/${id}/precios/${productoId}`, { precio }),
  quitarPrecio: (id: string, productoId: string) => api.delete<void>(`/listas-precio/${id}/precios/${productoId}`),
  historialPrecio: (id: string, productoId: string) =>
    api.get<HistorialPrecioLista[]>(`/listas-precio/${id}/precios/${productoId}/historial`),
};
