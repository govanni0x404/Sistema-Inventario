const prisma = require("../lib/prisma");
const { resolverRango } = require("../lib/rangoFechas");

// GET /api/auditoria?dias=30|desde=&hasta=&accion=
async function listar(req, res) {
  const { rangoInicio, rangoFin } = resolverRango(req.query, new Date());
  const { accion } = req.query;

  const where = { fecha: { gte: rangoInicio, lte: rangoFin } };
  if (accion) where.accion = String(accion);

  const registros = await prisma.registroAuditoria.findMany({
    where,
    include: {
      usuario: { select: { id: true, nombre: true } },
      usuarioAfectado: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: "desc" },
    take: 500,
  });

  res.json(registros);
}

module.exports = { listar };
