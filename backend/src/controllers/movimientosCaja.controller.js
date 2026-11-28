const { createHash } = require("node:crypto");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { bloquearTurnoCompartido } = require("../lib/turnoLock");
const { buscarTurnoAbierto, verificarDuenoTurno } = require("../lib/turnoAbierto");
const { montoEnCentavos } = require("../lib/dinero");

const TIPOS = ["retiro", "ingreso"];

const crearSchema = z.object({
  // Opcional: con la misma clave, un reintento devuelve el movimiento ya registrado.
  claveIdempotencia: z.string().uuid().transform((clave) => clave.toLowerCase()).optional(),
  turnoCajaId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS, { errorMap: () => ({ message: "Tipo inválido" }) }),
  monto: montoEnCentavos.refine((monto) => monto > 0, "El monto debe ser mayor a 0"),
  motivo: z.string().trim().min(1, "El motivo es obligatorio").max(500, "El motivo no puede superar los 500 caracteres"),
});

const INCLUDE = { usuario: { select: { id: true, nombre: true } } };

function serialize({ claveIdempotencia, huellaSolicitud, ...m }) {
  return { ...m, monto: Number(m.monto) };
}

// POST /api/movimientos-caja — retiro o ingreso de efectivo fuera de una venta, sobre el
// turno actualmente abierto.
async function crear(req, res) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const { claveIdempotencia, turnoCajaId, tipo, monto, motivo } = parsed.data;
  const usuarioId = req.user.id;
  const huellaSolicitud = claveIdempotencia
    ? createHash("sha256").update(JSON.stringify({ turnoCajaId: turnoCajaId ?? null, tipo, monto, motivo })).digest("hex")
    : null;

  const movimiento = await prisma.$transaction(async (tx) => {
    // Igual que en ventas: el candado por usuario+clave serializa los reintentos simultáneos.
    if (claveIdempotencia) {
      const claveUsuario = `${usuarioId}:${claveIdempotencia}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100005, hashtext(${claveUsuario}))::text`;
      const existente = await tx.movimientoCaja.findUnique({
        where: { usuarioId_claveIdempotencia: { usuarioId, claveIdempotencia } },
        include: INCLUDE,
      });
      if (existente) {
        if (existente.huellaSolicitud !== huellaSolicitud) {
          throw new HttpError(409, "Esta clave ya corresponde a un movimiento de caja con otros datos");
        }
        return existente;
      }
    }

    await bloquearTurnoCompartido(tx);
    const turnoAbierto = await buscarTurnoAbierto(tx, { turnoCajaId });
    if (!turnoAbierto) throw new HttpError(409, "No hay un turno de caja abierto");
    await verificarDuenoTurno(turnoAbierto, req.user);

    return tx.movimientoCaja.create({
      data: {
        turnoCajaId: turnoAbierto.id,
        tipo,
        monto: monto / 100,
        motivo,
        usuarioId,
        claveIdempotencia,
        huellaSolicitud,
      },
      include: INCLUDE,
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
    include: INCLUDE,
    orderBy: { fecha: "desc" },
  });
  res.json(movimientos.map(serialize));
}

module.exports = { crear, listarActual };
