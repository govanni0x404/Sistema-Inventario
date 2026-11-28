const HttpError = require("./HttpError");
const { tienePermiso } = require("./permisos");

async function buscarTurnoAbierto(db, { turnoCajaId, cajaId, include } = {}) {
  const where = { fechaCierre: null, ...(turnoCajaId && { id: turnoCajaId }), ...(cajaId && { cajaId }) };
  if (turnoCajaId || cajaId) return db.turnoCaja.findFirst({ where, include });

  const turnos = await db.turnoCaja.findMany({ where, include, take: 2 });
  if (turnos.length > 1) throw new HttpError(409, "Selecciona la caja para esta operación");
  return turnos[0] ?? null;
}

// Ventas, devoluciones, movimientos de caja y cierre operan sobre el turno de quien lo
// abrió. Un admin o un rol con la sección "turnos" (supervisión) puede operar cualquiera.
async function verificarDuenoTurno(turno, usuario) {
  if (!turno || turno.usuarioAperturaId === usuario.id) return;
  if (await tienePermiso(usuario.rol, "turnos")) return;
  throw new HttpError(403, "Este turno lo abrió otro usuario. Solo esa persona o un supervisor puede operarlo.");
}

module.exports = { buscarTurnoAbierto, verificarDuenoTurno };
