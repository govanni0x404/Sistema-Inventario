export type TipoMovimiento = "entrada" | "salida";

export interface MovimientoStock {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  origen: "manual" | "venta";
  cantidad: number;
  stockResultante: number;
  motivo: string | null;
  ventaId: string | null;
  usuarioId: string | null;
  usuario: { id: string; nombre: string } | null;
  fecha: string;
}

export type MovimientoInput = {
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string;
};
