import { api } from "./client";
import type { Proveedor, ProveedorConProductos, ProveedorInput } from "../types/proveedor";

export const proveedoresApi = {
  listar: (q?: string) => api.get<Proveedor[]>(`/proveedores${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  obtener: (id: string) => api.get<ProveedorConProductos>(`/proveedores/${id}`),
  crear: (data: ProveedorInput) => api.post<Proveedor>("/proveedores", data),
  actualizar: (id: string, data: Partial<ProveedorInput>) => api.put<Proveedor>(`/proveedores/${id}`, data),
  eliminar: (id: string) => api.delete<void>(`/proveedores/${id}`),
};
