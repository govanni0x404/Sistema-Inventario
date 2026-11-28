import { api } from "./client";

export interface ExistenciaPlanificada {
  id: string;
  bodegaId: string;
  bodegaNombre: string;
  bodegaActiva: boolean;
  productoId: string;
  productoNombre: string;
  productoOperativo: boolean;
  sku: string;
  codigoBarras: string | null;
  categoria: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  cantidad: number;
  minimoConfigurado: number | null;
  minimo: number;
  pendiente: string;
  sugerido: string;
  costoUnitario: string;
  valor: string;
}

interface InformePlanificacion {
  resumen: { total: number; unidades: string; valor: string; reponer: number; negativos: number };
  filas: ExistenciaPlanificada[];
  filasPorPagina: number;
}

export const planificacionApi = {
  listar: (params: URLSearchParams) => api.get<InformePlanificacion>(`/planificacion?${params}`),
  exportar: (params: URLSearchParams) =>
    api.get<ExistenciaPlanificada[]>(`/planificacion?${new URLSearchParams([...params, ["exportar", "true"]])}`),
  minimo: ({ bodegaId, productoId }: ExistenciaPlanificada, stockMinimo: number | null) =>
    api.put<void>(`/planificacion/${bodegaId}/productos/${productoId}/minimo`, { stockMinimo }),
};
