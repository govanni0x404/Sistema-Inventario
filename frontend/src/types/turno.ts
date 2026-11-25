import type { MetodoPago } from "./venta";

export type EstadoTurno = "abierto" | "cerrado";

export interface Caja {
  id: string;
  nombre: string;
  principal: boolean;
  activa: boolean;
  turnoAbierto: { id: string; nombre: string; montoInicial: number } | null;
}

export type CajaInput = Pick<Caja, "nombre" | "activa">;

export interface TipoTurno {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface ResumenVentasTurno {
  porMetodo: Partial<Record<MetodoPago, number>>;
  // Reembolsos hechos durante el turno; el de efectivo se resta del esperado en caja.
  devolucionesPorMetodo?: Partial<Record<MetodoPago, number>>;
  cantidadVentas: number;
  total: number;
}

export interface MovimientoCaja {
  id: string;
  turnoCajaId: string;
  tipo: "retiro" | "ingreso";
  monto: number;
  motivo: string;
  usuario: { id: string; nombre: string } | null;
  fecha: string;
}

export interface ResumenMovimientosCaja {
  ingresos: number;
  retiros: number;
  movimientos: MovimientoCaja[];
}

export interface TurnoCaja {
  id: string;
  cajaId: string;
  caja: { id: string; nombre: string };
  tipoTurnoId: string;
  tipoTurno: { id: string; nombre: string };
  estado: EstadoTurno;
  montoInicial: number;
  montoContado: number | null;
  montoEsperado: number | null;
  diferencia: number | null;
  notas: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  usuarioAperturaId: string | null;
  usuarioApertura: { id: string; nombre: string } | null;
  usuarioCierreId: string | null;
  usuarioCierre: { id: string; nombre: string } | null;
  resumenVentas?: ResumenVentasTurno;
  movimientosCaja?: ResumenMovimientosCaja;
}

export type TipoTurnoInput = { nombre: string; activo?: boolean };
export type AbrirTurnoInput = { tipoTurnoId: string; cajaId: string; montoInicial: number };
export type CerrarTurnoInput = { montoContado: number; notas?: string };
