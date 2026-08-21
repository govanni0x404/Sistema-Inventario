const prisma = require("../lib/prisma");
const { inicioDeDia, finDeDia, claveDia, resolverRango } = require("../lib/rangoFechas");

// GET /api/dashboard?dias=7|30|90 o ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — resumen agregado
// para la pantalla principal. "Ventas de hoy" siempre es el día calendario actual (referencia
// fija); el resto de las métricas usa el rango seleccionado.
async function resumen(req, res) {
  const ahora = new Date();
  const hoyInicio = inicioDeDia(ahora);
  const hoyFin = finDeDia(ahora);
  const { rangoInicio, rangoFin, dias } = resolverRango(req.query, ahora);

  const [
    ventasHoyAgg,
    ventasPeriodoAgg,
    productosActivos,
    productos,
    ventasRango,
    ventasPorMetodoRaw,
    itemsTopRaw,
  ] = await Promise.all([
    prisma.venta.aggregate({ where: { fecha: { gte: hoyInicio, lte: hoyFin }, esCortesia: false }, _sum: { total: true }, _count: true }),
    prisma.venta.aggregate({ where: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false }, _sum: { total: true }, _count: true }),
    prisma.producto.count({ where: { activo: true } }),
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, sku: true, stock: true, stockMinimo: true, precioCompra: true, unidad: { select: { nombre: true } } },
    }),
    prisma.venta.findMany({ where: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false }, select: { fecha: true, total: true } }),
    prisma.ventaPago.groupBy({
      by: ["metodoPago"],
      where: { venta: { fecha: { gte: rangoInicio, lte: rangoFin } } },
      _sum: { monto: true },
    }),
    prisma.ventaItem.groupBy({
      by: ["productoId"],
      where: { venta: { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 5,
    }),
  ]);

  const stockBajo = productos.filter((p) => p.stock <= p.stockMinimo);
  const valorInventario = productos.reduce((s, p) => s + p.stock * Number(p.precioCompra), 0);

  // Bucketiza ventas del rango por día (en JS: el volumen es pequeño y evita SQL crudo).
  const porDiaMap = new Map();
  for (let i = 0; i < dias; i++) {
    const d = new Date(rangoInicio.getTime() + i * 86400000);
    porDiaMap.set(claveDia(d), { fecha: claveDia(d), total: 0, cantidad: 0 });
  }
  for (const v of ventasRango) {
    const key = claveDia(v.fecha);
    const bucket = porDiaMap.get(key);
    if (bucket) {
      bucket.total += Number(v.total);
      bucket.cantidad += 1;
    }
  }

  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const productosTop = itemsTopRaw.map((it) => ({
    productoId: it.productoId,
    nombre: productoPorId.get(it.productoId)?.nombre ?? "Producto eliminado",
    sku: productoPorId.get(it.productoId)?.sku ?? "",
    cantidad: it._sum.cantidad,
    subtotal: Number(it._sum.subtotal),
  }));

  const ventasPeriodoCount = ventasPeriodoAgg._count;
  const ventasPeriodoTotal = Number(ventasPeriodoAgg._sum.total || 0);

  res.json({
    rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin), dias },
    kpis: {
      ventasHoy: { total: Number(ventasHoyAgg._sum.total || 0), cantidad: ventasHoyAgg._count },
      ventasPeriodo: { total: ventasPeriodoTotal, cantidad: ventasPeriodoCount },
      ticketPromedioPeriodo: ventasPeriodoCount > 0 ? ventasPeriodoTotal / ventasPeriodoCount : 0,
      productosActivos,
      productosStockBajo: stockBajo.length,
      valorInventario,
    },
    ventasPorDia: [...porDiaMap.values()],
    ventasPorMetodo: ventasPorMetodoRaw
      .map((v) => ({ metodoPago: v.metodoPago, total: Number(v._sum.monto || 0) }))
      .sort((a, b) => b.total - a.total),
    productosTop,
    stockBajo: stockBajo
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
      .map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku, stock: p.stock, stockMinimo: p.stockMinimo, unidad: p.unidad.nombre })),
  });
}

module.exports = { resumen };
