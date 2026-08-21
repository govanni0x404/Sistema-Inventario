export interface VentaEnEsperaItem {
  id: string;
  productoId: string;
  cantidad: number;
  descuento: number;
  producto: { id: string; nombre: string; sku: string; precioVenta: number; stock: number };
}

export interface VentaEnEspera {
  id: string;
  referencia: string | null;
  clienteId: string | null;
  cliente: { id: string; nombre: string } | null;
  descuento: number;
  usuario: { id: string; nombre: string } | null;
  creadoEn: string;
  items: VentaEnEsperaItem[];
}

export type VentaEnEsperaInput = {
  referencia?: string | null;
  clienteId?: string | null;
  descuento?: number;
  items: { productoId: string; cantidad: number; descuento?: number }[];
};
