const prisma = require("../lib/prisma");
const { resolverRango, claveDia } = require("../lib/rangoFechas");

// GET /api/consultas/productos-top?dias=|desde=&hasta=&limite=
async function productosTop(req, res) {
  const ahora = new Date();
  const { rangoInicio, rangoFin } = resolverRango(req.query, ahora);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 20));

  const itemsRaw = await prisma.ventaItem.groupBy({
    by: ["productoId"],
    where: { venta: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false } },
    _sum: { cantidad: true, subtotal: true },
    orderBy: { _sum: { subtotal: "desc" } },
    take: limite,
  });

  const productos = await prisma.producto.findMany({
    where: { id: { in: itemsRaw.map((i) => i.productoId) } },
    select: { id: true, nombre: true, sku: true },
  });
  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  res.json({
    rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin) },
    productos: itemsRaw.map((it) => ({
      productoId: it.productoId,
      nombre: productoPorId.get(it.productoId)?.nombre ?? "Producto eliminado",
      sku: productoPorId.get(it.productoId)?.sku ?? "",
      cantidad: it._sum.cantidad,
      subtotal: Number(it._sum.subtotal),
    })),
  });
}

// GET /api/consultas/ventas-por-metodo?dias=|desde=&hasta=
async function ventasPorMetodo(req, res) {
  const ahora = new Date();
  const { rangoInicio, rangoFin } = resolverRango(req.query, ahora);

  const grupos = await prisma.ventaPago.groupBy({
    by: ["metodoPago"],
    where: { venta: { fecha: { gte: rangoInicio, lte: rangoFin } } },
    _sum: { monto: true },
    _count: true,
  });

  res.json({
    rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin) },
    metodos: grupos
      .map((g) => ({ metodoPago: g.metodoPago, total: Number(g._sum.monto || 0), cantidad: g._count }))
      .sort((a, b) => b.total - a.total),
  });
}

// GET /api/consultas/ventas-por-usuario?dias=|desde=&hasta=
async function ventasPorUsuario(req, res) {
  const ahora = new Date();
  const { rangoInicio, rangoFin } = resolverRango(req.query, ahora);

  const [ventasGrupos, cortesiasGrupos] = await Promise.all([
    prisma.venta.groupBy({
      by: ["usuarioId"],
      where: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.groupBy({
      by: ["usuarioId"],
      where: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: true },
      _count: true,
    }),
  ]);

  const usuarioIds = [...new Set([...ventasGrupos, ...cortesiasGrupos].map((g) => g.usuarioId).filter(Boolean))];
  const usuarios = await prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true } });
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const cortesiasPorUsuario = new Map(cortesiasGrupos.map((g) => [g.usuarioId, g._count]));

  const filas = ventasGrupos
    .map((g) => ({
      usuarioId: g.usuarioId,
      nombre: usuarioPorId.get(g.usuarioId)?.nombre ?? "Usuario eliminado",
      cantidadVentas: g._count,
      total: Number(g._sum.total || 0),
      cantidadCortesias: cortesiasPorUsuario.get(g.usuarioId) || 0,
    }))
    .sort((a, b) => b.total - a.total);

  res.json({ rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin) }, usuarios: filas });
}

module.exports = { productosTop, ventasPorMetodo, ventasPorUsuario };
