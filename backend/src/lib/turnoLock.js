// Candado de Postgres (advisory lock) para todo lo que toca la caja del turno.
// - Abrir/cerrar turno toman el candado EXCLUSIVO: dos aperturas simultáneas no pueden
//   crear dos turnos abiertos, y nada puede colarse mientras se calcula el arqueo.
// - Ventas, devoluciones y movimientos de caja toman el candado COMPARTIDO: pueden correr
//   en paralelo entre sí, pero esperan si hay una apertura/cierre en curso.
// Ambos son "xact": se liberan solos al terminar la transacción (commit o rollback).
const TURNO_LOCK_KEY = 72100001;

async function bloquearTurnoExclusivo(tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${TURNO_LOCK_KEY})::text`;
}

async function bloquearTurnoCompartido(tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(${TURNO_LOCK_KEY})::text`;
}

module.exports = { bloquearTurnoExclusivo, bloquearTurnoCompartido };
