export interface Bodega {
  id: string;
  nombre: string;
  direccion: string | null;
  principal: boolean;
  activo: boolean;
}

export type BodegaInput = { nombre: string; direccion?: string | null; activo?: boolean };

export interface StockBodegaItem {
  id: string;
  bodegaId: string;
  productoId: string;
  cantidad: number;
  producto: { id: string; nombre: string; codigoBarras: string | null; unidad: { nombre: string } };
}

export type TransferenciaInput = {
  origenBodegaId: string;
  destinoBodegaId: string;
  productoId: string;
  cantidad: number;
  motivo?: string;
};

export interface TransferenciaResultado {
  salida: { id: string; stockResultante: number };
  entrada: { id: string; stockResultante: number };
}

export type ModoInventario = "inventario" | "ajuste";

export interface CantidadContada {
  productoId: string;
  stockEsperado: number;
  stockContado: number;
}

export interface TomaInventarioInput {
  id: string;
  tipo: ModoInventario;
  motivo: string;
  items: CantidadContada[];
}

export interface ResumenTomaInventario {
  id: string;
  bodegaId: string;
  bodegaNombre: string;
  usuarioNombre: string;
  tipo: ModoInventario;
  motivo: string;
  fecha: string;
  lineas: number;
  ajustes: number;
}

export interface TomaInventario extends ResumenTomaInventario {
  items: (CantidadContada & { nombre: string; codigoBarras: string | null; unidad: string; diferencia: number })[];
}
