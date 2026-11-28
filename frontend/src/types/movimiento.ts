export type TipoMovimiento = "entrada" | "salida";

export const origenesMovimiento = {
  manual: "Movimiento manual",
  venta: "Venta",
  devolucion: "Devolución de venta",
  transferencia: "Traspaso entre bodegas",
  inventario: "Toma de inventario",
  ajuste: "Ajuste de stock",
  compra: "Recepción de compra",
  devolucion_compra: "Devolución a proveedor",
  saldo_inicial: "Saldo inicial",
  merma: "Merma",
} as const;

export const causasMerma = {
  vencimiento: "Vencimiento", dano: "Daño", perdida: "Pérdida", contaminacion: "Contaminación", otra: "Otra",
} as const;
export type CausaMerma = keyof typeof causasMerma;

export interface MovimientoStock {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  origen: keyof typeof origenesMovimiento;
  cantidad: number;
  stockResultante: number;
  motivo: string | null;
  causaMerma?: CausaMerma | null;
  costoMerma?: string | null;
  ventaId: string | null;
  usuarioId: string | null;
  usuario: { id: string; nombre: string } | null;
  bodegaId: string | null;
  tomaInventarioId?: string | null;
  operacionCompraId?: string | null;
  ordenCompraId?: string | null;
  fecha: string;
}

export interface MovimientoKardex extends MovimientoStock {
  producto: { id: string; nombre: string; codigoBarras: string | null; unidad: { nombre: string } };
  bodega: { id: string; nombre: string } | null;
  operacionCompra: { ordenId: string; documento: string } | null;
}

export type MovimientoInput = {
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string;
  bodegaId?: string;
  causaMerma?: CausaMerma;
  operacionId?: string;
};
