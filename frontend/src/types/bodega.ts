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
  producto: { id: string; nombre: string; sku: string; unidad: { nombre: string } };
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
