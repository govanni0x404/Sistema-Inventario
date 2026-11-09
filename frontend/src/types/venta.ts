export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

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
  producto?: { id: string; nombre: string; sku: string };
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
  fecha: string;
  usuario?: { id: string; nombre: string } | null;
  items: DevolucionItem[];
}

export interface Venta {
  id: string;
  fecha: string;
  clienteId: string | null;
  cliente: { id: string; nombre: string } | null;
  subtotal: number;
  descuento: number;
  total: number;
  esCortesia: boolean;
  motivoCortesia: string | null;
  pagos: VentaPago[];
  items: VentaItem[];
  turnoCajaId?: string | null;
  turnoCaja?: { id: string; tipoTurno: { nombre: string } } | null;
  devoluciones?: Devolucion[];
}

export type VentaInput = {
  clienteId?: string | null;
  listaPrecioId?: string | null;
  pagos?: { metodoPago: MetodoPago; monto: number }[];
  esCortesia?: boolean;
  motivoCortesia?: string | null;
  descuento?: number;
  items: { productoId: string; cantidad: number; descuento?: number }[];
};

export type DevolucionInput = {
  motivo?: string | null;
  items: { ventaItemId: string; cantidad: number }[];
};
