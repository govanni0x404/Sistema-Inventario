const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { bloquearTurnoCompartido } = require("../lib/turnoLock");
const { buscarTurnoAbierto } = require("../lib/turnoAbierto");

const TIPOS = ["retiro", "ingreso"];

const crearSchema = z.object({
  turnoCajaId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS, { errorMap: () => ({ message: "Tipo inválido" }) }),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  motivo: z.string().trim().min(1, "El motivo es obligatorio"),
});

function serialize(m) {
  return { ...m, monto: Number(m.monto) };
}

// POST /api/movimientos-caja — retiro o ingreso de efectivo fuera de una venta, sobre el
// turno actualmente abierto.
async function crear(req, res) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const movimiento = await prisma.$transaction(async (tx) => {
    await bloquearTurnoCompartido(tx);
    const turnoAbierto = await buscarTurnoAbierto(tx, { turnoCajaId: parsed.data.turnoCajaId });
    if (!turnoAbierto) throw new HttpError(409, "No hay un turno de caja abierto");

    return tx.movimientoCaja.create({
      data: {
        turnoCajaId: turnoAbierto.id,
        tipo: parsed.data.tipo,
        monto: parsed.data.monto,
        motivo: parsed.data.motivo,
        usuarioId: req.user?.id,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  });
  res.status(201).json(serialize(movimiento));
}

// GET /api/movimientos-caja — movimientos del turno actualmente abierto (para el panel de Caja).
async function listarActual(req, res) {
  const parsed = z.string().uuid().optional().safeParse(req.query.turnoCajaId);
  if (!parsed.success) throw new HttpError(400, "Turno inválido");
  const turnoAbierto = await buscarTurnoAbierto(prisma, { turnoCajaId: parsed.data });
  if (!turnoAbierto) return res.json([]);

  const movimientos = await prisma.movimientoCaja.findMany({
    where: { turnoCajaId: turnoAbierto.id },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fecha: "desc" },
  });
  res.json(movimientos.map(serialize));
}

module.exports = { crear, listarActual };
