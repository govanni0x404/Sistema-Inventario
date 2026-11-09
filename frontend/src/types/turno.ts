export type EstadoTurno = "abierto" | "cerrado";

export interface TipoTurno {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface ResumenVentasTurno {
  porMetodo: { efectivo: number; tarjeta: number; transferencia: number };
  // Reembolsos hechos durante el turno; el de efectivo se resta del esperado en caja.
  devolucionesPorMetodo?: { efectivo: number; tarjeta: number; transferencia: number };
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
export type AbrirTurnoInput = { tipoTurnoId: string; montoInicial: number };
export type CerrarTurnoInput = { montoContado: number; notas?: string };
