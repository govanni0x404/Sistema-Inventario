const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { bloquearTurnoExclusivo } = require("../lib/turnoLock");
const { fechaDeQuery } = require("../lib/rangoFechas");

const round2 = (n) => Math.round(n * 100) / 100;

const INCLUDE = {
  tipoTurno: { select: { id: true, nombre: true } },
  usuarioApertura: { select: { id: true, nombre: true } },
  usuarioCierre: { select: { id: true, nombre: true } },
};

function serialize(t) {
  return {
    ...t,
    montoInicial: Number(t.montoInicial),
    montoContado: t.montoContado != null ? Number(t.montoContado) : null,
    montoEsperado: t.montoEsperado != null ? Number(t.montoEsperado) : null,
    diferencia: t.diferencia != null ? Number(t.diferencia) : null,
  };
}

// El arqueo de caja necesita saber cuánto efectivo entró realmente: una venta puede estar
// pagada mitad efectivo mitad tarjeta, así que se agrupa por VentaPago (no por Venta), y
// la cantidad/total de ventas se cuenta aparte sobre Venta para no duplicar por pago.
async function resumenVentasDeTurno(turnoCajaId, db = prisma) {
  const [gruposPago, ventasAgg, gruposDevolucion] = await Promise.all([
    db.ventaPago.groupBy({
      by: ["metodoPago"],
      where: { venta: { turnoCajaId } },
      _sum: { monto: true },
    }),
    db.venta.aggregate({ where: { turnoCajaId, esCortesia: false }, _sum: { total: true }, _count: true }),
    // Reembolsos hechos durante este turno (de ventas de este u otro turno).
    db.devolucion.groupBy({
      by: ["metodoReembolso"],
      where: { turnoCajaId, metodoReembolso: { not: null } },
      _sum: { total: true },
    }),
  ]);

  const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const g of gruposPago) {
    porMetodo[g.metodoPago] = Number(g._sum.monto || 0);
  }
  const devolucionesPorMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const g of gruposDevolucion) {
    devolucionesPorMetodo[g.metodoReembolso] = Number(g._sum.total || 0);
  }

  return {
    porMetodo,
    devolucionesPorMetodo,
    cantidadVentas: ventasAgg._count,
    total: Number(ventasAgg._sum.total || 0),
  };
}

// Retiros/ingresos de efectivo que no vienen de una venta (pago a proveedor, cambio, etc.).
async function resumenMovimientosCaja(turnoCajaId, db = prisma) {
  const grupos = await db.movimientoCaja.groupBy({
    by: ["tipo"],
    where: { turnoCajaId },
    _sum: { monto: true },
  });
  const porTipo = { retiro: 0, ingreso: 0 };
  for (const g of grupos) porTipo[g.tipo] = Number(g._sum.monto || 0);

  const movimientos = await db.movimientoCaja.findMany({
    where: { turnoCajaId },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  return {
    ingresos: porTipo.ingreso,
    retiros: porTipo.retiro,
    movimientos: movimientos.map((m) => ({ ...m, monto: Number(m.monto) })),
  };
}

// GET /api/turnos?estado=&desde=&hasta=
async function listar(req, res) {
  const { estado, desde, hasta } = req.query;
  const where = {};
  if (estado) where.estado = String(estado);
  if (desde || hasta) {
    where.fechaApertura = {};
    if (desde) where.fechaApertura.gte = fechaDeQuery(desde, { nombre: "desde" });
    if (hasta) where.fechaApertura.lte = fechaDeQuery(hasta, { nombre: "hasta", finDelDia: true });
  }

  const turnos = await prisma.turnoCaja.findMany({ where, include: INCLUDE, orderBy: { fechaApertura: "desc" } });
  res.json(turnos.map(serialize));
}

// GET /api/turnos/actual — el turno abierto ahora mismo, o null.
async function actual(req, res) {
  const turno = await prisma.turnoCaja.findFirst({ where: { estado: "abierto" }, include: INCLUDE });
  res.json(turno ? serialize(turno) : null);
}

// GET /api/turnos/:id
async function obtener(req, res) {
  const turno = await prisma.turnoCaja.findUnique({ where: { id: req.params.id }, include: INCLUDE });
  if (!turno) throw new HttpError(404, "Turno no encontrado");
  const resumenVentas = await resumenVentasDeTurno(turno.id);
  const movimientosCaja = await resumenMovimientosCaja(turno.id);
  res.json({ ...serialize(turno), resumenVentas, movimientosCaja });
}

const abrirSchema = z.object({
  tipoTurnoId: z.string().uuid("Selecciona un tipo de turno"),
  montoInicial: z.coerce.number().nonnegative(),
});

// POST /api/turnos — abre un nuevo turno. Solo puede haber uno abierto a la vez.
async function abrir(req, res) {
  const parsed = abrirSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const tipoTurno = await prisma.tipoTurno.findUnique({ where: { id: parsed.data.tipoTurnoId } });
  if (!tipoTurno || !tipoTurno.activo) throw new HttpError(404, "Tipo de turno no encontrado o inactivo");

  // Con el candado exclusivo, dos aperturas al mismo tiempo se hacen una después de la otra:
  // la segunda ya ve el turno que abrió la primera y responde 409.
  const turno = await prisma.$transaction(async (tx) => {
    await bloquearTurnoExclusivo(tx);
    const abierto = await tx.turnoCaja.findFirst({ where: { estado: "abierto" } });
    if (abierto) throw new HttpError(409, "Ya hay un turno de caja abierto");

    return tx.turnoCaja.create({
      data: {
        tipoTurnoId: parsed.data.tipoTurnoId,
        montoInicial: parsed.data.montoInicial,
        usuarioAperturaId: req.user?.id,
      },
      include: INCLUDE,
    });
  });

  res.status(201).json(serialize(turno));
}

const cerrarSchema = z.object({
  montoContado: z.coerce.number().nonnegative(),
  notas: z.string().trim().optional().nullable(),
});

// POST /api/turnos/:id/cerrar — arqueo: calcula el esperado y la diferencia contra lo contado.
async function cerrar(req, res) {
  const parsed = cerrarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  // Candado exclusivo: mientras se calcula el arqueo no entra ninguna venta, devolución
  // ni movimiento de caja (todas esas operaciones toman el candado compartido).
  const actualizado = await prisma.$transaction(async (tx) => {
    await bloquearTurnoExclusivo(tx);
    const turno = await tx.turnoCaja.findUnique({ where: { id: req.params.id } });
    if (!turno) throw new HttpError(404, "Turno no encontrado");
    if (turno.estado !== "abierto") throw new HttpError(409, "Este turno ya está cerrado");

    const { porMetodo, devolucionesPorMetodo } = await resumenVentasDeTurno(turno.id, tx);
    const { ingresos, retiros } = await resumenMovimientosCaja(turno.id, tx);
    // El efectivo devuelto en el turno salió de la caja: se resta de lo esperado.
    const montoEsperado = round2(
      Number(turno.montoInicial) + porMetodo.efectivo - devolucionesPorMetodo.efectivo + ingresos - retiros
    );
    const diferencia = round2(parsed.data.montoContado - montoEsperado);

    return tx.turnoCaja.update({
      where: { id: turno.id },
      data: {
        estado: "cerrado",
        fechaCierre: new Date(),
        usuarioCierreId: req.user?.id,
        montoContado: parsed.data.montoContado,
        montoEsperado,
        diferencia,
        notas: parsed.data.notas || null,
      },
      include: INCLUDE,
    });
  });

  const resumenVentas = await resumenVentasDeTurno(actualizado.id);
  const movimientosCaja = await resumenMovimientosCaja(actualizado.id);
  res.json({ ...serialize(actualizado), resumenVentas, movimientosCaja });
}

module.exports = { listar, actual, obtener, abrir, cerrar };
