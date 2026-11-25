export interface ListaPrecio {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
}

export interface PrecioLista {
  id: string;
  listaPrecioId: string;
  productoId: string;
  precio: number;
  producto: { id: string; nombre: string; codigoBarras: string | null; precioVenta: number };
}

export type ListaPrecioInput = { nombre: string; copiarPrecios?: boolean };
export type ListaPrecioUpdateInput = { nombre?: string; activo?: boolean };

export interface HistorialPrecioLista {
  id: string;
  listaPrecioId: string;
  productoId: string;
  precioAnterior: number | null;
  precioNuevo: number | null;
  usuario: { id: string; nombre: string } | null;
  fecha: string;
}
