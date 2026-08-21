import { api } from "./client";
import type { Producto, ProductoInput, ImportarResultado } from "../types/producto";
import type { HistorialPrecio } from "../types/historialPrecio";

export const productosApi = {
  listar: (q?: string) =>
    api.get<Producto[]>(`/productos${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  listarConStockBajo: () => api.get<Producto[]>("/productos?stockBajo=true&activo=true"),
  crear: (data: ProductoInput) => api.post<Producto>("/productos", data),
  actualizar: (id: string, data: Partial<ProductoInput>) =>
    api.put<Producto>(`/productos/${id}`, data),
  eliminar: (id: string) =>
    api.delete<(Producto & { _desactivado: true }) | undefined>(`/productos/${id}`),
  historialPrecios: (id: string) => api.get<HistorialPrecio[]>(`/productos/${id}/historial-precios`),
  importar: (productos: Record<string, unknown>[]) =>
    api.post<ImportarResultado>("/productos/importar", { productos }),
};
