import type { DocumentoVenta } from "./negocio";

export interface VentaEnEsperaItem {
  id: string;
  productoId: string;
  cantidad: number;
  descuento: number;
  producto: { id: string; nombre: string; codigoBarras: string | null; precioVenta: number; stock: number; stockCaja: number; activo: boolean; ventaPublico: boolean; inventariable: boolean };
}

export interface VentaEnEspera {
  id: string;
  referencia: string | null;
  clienteId: string | null;
  cliente: { id: string; nombre: string } | null;
  descuento: number;
  tipoDocumento: DocumentoVenta;
  usuario: { id: string; nombre: string } | null;
  creadoEn: string;
  items: VentaEnEsperaItem[];
}

export type VentaEnEsperaInput = {
  referencia?: string | null;
  clienteId?: string | null;
  descuento?: number;
  tipoDocumento?: DocumentoVenta;
  items: { productoId: string; cantidad: number; descuento?: number }[];
};
