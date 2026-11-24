const HttpError = require("./HttpError");

async function buscarTurnoAbierto(db, { turnoCajaId, cajaId, include } = {}) {
  const where = { estado: "abierto", ...(turnoCajaId && { id: turnoCajaId }), ...(cajaId && { cajaId }) };
  if (turnoCajaId || cajaId) return db.turnoCaja.findFirst({ where, include });

  const turnos = await db.turnoCaja.findMany({ where, include, take: 2 });
  if (turnos.length > 1) throw new HttpError(409, "Selecciona la caja para esta operación");
  return turnos[0] ?? null;
}

module.exports = { buscarTurnoAbierto };
