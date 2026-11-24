const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { montoEnCentavos } = require("../lib/dinero");
const { bloquearTurnoExclusivo } = require("../lib/turnoLock");

const cajaSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  fondoFijo: montoEnCentavos.optional(),
  activa: z.boolean().default(true),
});

function serializar({ turnos, ...caja }) {
  const turno = turnos[0];
  return {
    ...caja,
    fondoFijo: Number(caja.fondoFijo ?? 0),
    turnoAbierto: turno ? { id: turno.id, nombre: turno.tipoTurno.nombre, montoInicial: Number(turno.montoInicial) } : null,
  };
}

const include = {
  turnos: {
    where: { estado: "abierto" },
    select: { id: true, montoInicial: true, tipoTurno: { select: { nombre: true } } },
    take: 1,
  },
};

async function listar(req, res) {
  const todas = req.query.todas === "true" && req.user.rol === "admin";
  const cajas = await prisma.caja.findMany({
    where: todas ? {} : { activa: true },
    orderBy: [{ principal: "desc" }, { nombre: "asc" }],
    include,
  });
  res.json(cajas.map(serializar));
}

async function guardar(req, res) {
  const parsed = cajaSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Indica un nombre y un fondo fijo válido");
  const { nombre, fondoFijo, activa } = parsed.data;
  const id = req.params.id;
  const caja = await prisma.$transaction(async (tx) => {
    await bloquearTurnoExclusivo(tx);
    if (id) {
      const anterior = await tx.caja.findUnique({ where: { id }, include });
      if (!anterior) throw new HttpError(404, "Caja no encontrada");
      if (!activa && (anterior.principal || anterior.turnos.length)) {
        throw new HttpError(409, anterior.principal ? "La caja principal debe permanecer activa" : "Cierra el turno antes de desactivar la caja");
      }
    }
    const misma = await tx.caja.findUnique({ where: { nombre } });
    if (misma && misma.id !== id) throw new HttpError(409, "Ya existe una caja con ese nombre");
    const data = { nombre, activa, ...(fondoFijo !== undefined && { fondoFijo: fondoFijo / 100 }) };
    return id ? tx.caja.update({ where: { id }, data, include }) : tx.caja.create({ data, include });
  });
  res.status(id ? 200 : 201).json(serializar(caja));
}

module.exports = { listar, guardar };
