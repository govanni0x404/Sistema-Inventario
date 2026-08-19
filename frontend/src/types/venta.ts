export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto?: { id: string; nombre: string; sku: string };
}

export interface Venta {
  id: string;
  fecha: string;
  clienteId: string | null;
  cliente: { id: string; nombre: string } | null;
  total: number;
  metodoPago: MetodoPago;
  items: VentaItem[];
  turnoCajaId?: string | null;
  turnoCaja?: { id: string; tipoTurno: { nombre: string } } | null;
}

export type VentaInput = {
  clienteId?: string | null;
  metodoPago: MetodoPago;
  items: { productoId: string; cantidad: number }[];
};
