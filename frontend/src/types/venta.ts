import type { DocumentoVenta } from "./negocio";

export const ETIQUETAS_PAGO = { efectivo: "Efectivo", tarjeta: "Tarjeta", debito: "Débito", credito: "Crédito", transferencia: "Transferencia" } as const;
export type MetodoPago = keyof typeof ETIQUETAS_PAGO;

export interface VentaPago {
  id: string;
  metodoPago: MetodoPago;
  monto: number;
}

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  importeCobrado?: number;
  producto?: { id: string; nombre: string; codigoBarras: string | null };
}

export interface DevolucionItem {
  id: string;
  ventaItemId: string;
  cantidad: number;
  subtotal: number;
}

export interface Devolucion {
  id: string;
  ventaId: string;
  motivo: string | null;
  total: number;
  metodoReembolso?: MetodoPago | null;
  turnoCajaId?: string | null;
  fecha: string;
  usuario?: { id: string; nombre: string } | null;
  items: DevolucionItem[];
}

export interface Venta {
  id: string;
  fecha: string;
  clienteId: string | null;
  cotizacionId?: string | null;
  cliente: { id: string; nombre: string } | null;
  subtotal: number;
  descuento: number;
  total: number;
  tipoDocumento: DocumentoVenta;
  esCortesia: boolean;
  motivoCortesia: string | null;
  pagos: VentaPago[];
  items: VentaItem[];
  turnoCajaId?: string | null;
  turnoCaja?: { id: string; caja: { nombre: string }; tipoTurno: { nombre: string } } | null;
  devoluciones?: Devolucion[];
}

export type VentaInput = {
  turnoCajaId?: string;
  claveIdempotencia?: string;
  clienteId?: string | null;
  cotizacionId?: string;
  listaPrecioId?: string | null;
  tipoDocumento?: DocumentoVenta;
  pagos?: { metodoPago: MetodoPago; monto: number }[];
  esCortesia?: boolean;
  motivoCortesia?: string | null;
  descuento?: number;
  items: { productoId: string; cantidad: number; descuento?: number }[];
};

export type DevolucionInput = {
  turnoCajaId?: string;
  motivo?: string | null;
  metodoReembolso?: MetodoPago | null;
  items: { ventaItemId: string; cantidad: number }[];
};
