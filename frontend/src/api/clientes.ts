import { api } from "./client";
import type { Cliente, ClienteConVentas, ClienteInput } from "../types/cliente";

export const clientesApi = {
  listar: (q?: string) => api.get<Cliente[]>(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  obtener: (id: string) => api.get<ClienteConVentas>(`/clientes/${id}`),
  crear: (data: ClienteInput) => api.post<Cliente>("/clientes", data),
  actualizar: (id: string, data: Partial<ClienteInput>) => api.put<Cliente>(`/clientes/${id}`, data),
  eliminar: (id: string) => api.delete<void>(`/clientes/${id}`),
};
