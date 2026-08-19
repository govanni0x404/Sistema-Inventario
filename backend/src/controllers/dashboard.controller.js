const prisma = require("../lib/prisma");

function inicioDeDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDeDia(fecha) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

function claveDia(fecha) {
  return new Date(fecha).toISOString().slice(0, 10);
}

// GET /api/dashboard — resumen agregado para la pantalla principal.
async function resumen(req, res) {
  const ahora = new Date();
  const hoyInicio = inicioDeDia(ahora);
  const hoyFin = finDeDia(ahora);
  const mesInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const dias = 14;
  const rangoInicio = inicioDeDia(new Date(ahora.getTime() - (dias - 1) * 86400000));

  const [
    ventasHoyAgg,
    ventasMesAgg,
    productosActivos,
    productos,
    ventasRango,
    ventasPorMetodoRaw,
    itemsTopRaw,
  ] = await Promise.all([
    prisma.venta.aggregate({ where: { fecha: { gte: hoyInicio, lte: hoyFin } }, _sum: { total: true }, _count: true }),
    prisma.venta.aggregate({ where: { fecha: { gte: mesInicio } }, _sum: { total: true }, _count: true }),
    prisma.producto.count({ where: { activo: true } }),
    prisma.producto.findMany({ where: { activo: true }, select: { id: true, nombre: true, sku: true, stock: true, stockMinimo: true, precioCompra: true, unidad: true } }),
    prisma.venta.findMany({ where: { fecha: { gte: rangoInicio } }, select: { fecha: true, total: true } }),
    prisma.venta.groupBy({ by: ["metodoPago"], where: { fecha: { gte: mesInicio } }, _sum: { total: true } }),
    prisma.ventaItem.groupBy({
      by: ["productoId"],
      where: { venta: { fecha: { gte: mesInicio } } },
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

  const ventasMesCount = ventasMesAgg._count;
  const ventasMesTotal = Number(ventasMesAgg._sum.total || 0);

  res.json({
    kpis: {
      ventasHoy: { total: Number(ventasHoyAgg._sum.total || 0), cantidad: ventasHoyAgg._count },
      ventasMes: { total: ventasMesTotal, cantidad: ventasMesCount },
      ticketPromedioMes: ventasMesCount > 0 ? ventasMesTotal / ventasMesCount : 0,
      productosActivos,
      productosStockBajo: stockBajo.length,
      valorInventario,
    },
    ventasPorDia: [...porDiaMap.values()],
    ventasPorMetodo: ventasPorMetodoRaw
      .map((v) => ({ metodoPago: v.metodoPago, total: Number(v._sum.total || 0) }))
      .sort((a, b) => b.total - a.total),
    productosTop,
    stockBajo: stockBajo
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
      .map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku, stock: p.stock, stockMinimo: p.stockMinimo, unidad: p.unidad })),
  });
}

module.exports = { resumen };
