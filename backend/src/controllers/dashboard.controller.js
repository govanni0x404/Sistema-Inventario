const prisma = require("../lib/prisma");
const { inicioDeDia, finDeDia, claveDia, resolverRango, sumarDias } = require("../lib/rangoFechas");
const { stockCajaInclude, conStockCaja } = require("../lib/stockBodega");
const { agruparProductosVendidos } = require("../lib/reportesVenta");

// GET /api/dashboard?dias=7|30|90 o ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — resumen agregado
// para la pantalla principal. "Ventas de hoy" siempre es el día calendario actual (referencia
// fija); el resto de las métricas usa el rango seleccionado.
async function resumen(req, res) {
  const ahora = new Date();
  const hoyInicio = inicioDeDia(ahora);
  const hoyFin = finDeDia(ahora);
  const { rangoInicio, rangoFin, dias } = resolverRango(req.query, ahora);
  const ventasDelRango = { fecha: { gte: rangoInicio, lte: rangoFin }, esCortesia: false };

  const [
    ventasHoyAgg,
    ventasPeriodoAgg,
    productos,
    ventasRango,
    ventasPorMetodoRaw,
    itemsTopRaw,
    ventasPorUsuarioRaw,
    ventasRecientes,
  ] = await Promise.all([
    prisma.venta.aggregate({ where: { fecha: { gte: hoyInicio, lte: hoyFin }, esCortesia: false }, _sum: { total: true }, _count: true }),
    prisma.venta.aggregate({ where: ventasDelRango, _sum: { total: true }, _count: true }),
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, codigoBarras: true, stockBodegas: stockCajaInclude, stockMinimo: true, precioCompra: true, unidad: { select: { nombre: true } } },
    }).then((filas) => filas.map(conStockCaja)),
    prisma.venta.findMany({ where: ventasDelRango, select: { fecha: true, total: true } }),
    prisma.ventaPago.groupBy({
      by: ["metodoPago"],
      where: { venta: ventasDelRango },
      _sum: { monto: true },
    }),
    agruparProductosVendidos(rangoInicio, rangoFin, 5),
    prisma.venta.groupBy({
      by: ["usuarioId"],
      where: ventasDelRango,
      _sum: { total: true },
      _count: true,
      orderBy: [{ _sum: { total: "desc" } }, { usuarioId: "asc" }],
      take: 8,
    }),
    prisma.venta.findMany({
      where: { fecha: ventasDelRango.fecha },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true, fecha: true, total: true, esCortesia: true,
        usuario: { select: { nombre: true } },
        pagos: { select: { metodoPago: true, monto: true } },
      },
    }),
  ]);

  const idsUsuarios = ventasPorUsuarioRaw.map((v) => v.usuarioId).filter(Boolean);
  const usuarios = idsUsuarios.length ? await prisma.usuario.findMany({
    where: { id: { in: idsUsuarios } }, select: { id: true, nombre: true },
  }) : [];
  const nombresUsuarios = new Map(usuarios.map(({ id, nombre }) => [id, nombre]));
  const stockBajo = productos.filter((p) => p.stock <= p.stockMinimo);
  const valorInventario = productos.reduce((s, p) => s + p.stock * Number(p.precioCompra), 0);

  // Bucketiza ventas del rango por día (en JS: el volumen es pequeño y evita SQL crudo).
  const porDiaMap = new Map();
  for (let i = 0; i < dias; i++) {
    const fecha = claveDia(sumarDias(rangoInicio, i));
    porDiaMap.set(fecha, { fecha, total: 0, cantidad: 0 });
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
    codigoBarras: productoPorId.get(it.productoId)?.codigoBarras ?? null,
    cantidad: it.cantidad,
    subtotal: it.subtotal,
  }));

  const ventasPeriodoCount = ventasPeriodoAgg._count;
  const ventasPeriodoTotal = Number(ventasPeriodoAgg._sum.total || 0);

  res.json({
    rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin), dias },
    kpis: {
      ventasHoy: { total: Number(ventasHoyAgg._sum.total || 0), cantidad: ventasHoyAgg._count },
      ventasPeriodo: { total: ventasPeriodoTotal, cantidad: ventasPeriodoCount },
      ticketPromedioPeriodo: ventasPeriodoCount > 0 ? ventasPeriodoTotal / ventasPeriodoCount : 0,
      productosActivos: productos.length,
      productosStockBajo: stockBajo.length,
      valorInventario,
    },
    ventasPorDia: [...porDiaMap.values()],
    ventasPorUsuario: ventasPorUsuarioRaw.map((v) => ({
      usuarioId: v.usuarioId,
      nombre: nombresUsuarios.get(v.usuarioId) ?? "Sin usuario",
      cantidad: v._count,
      total: Number(v._sum.total || 0),
    })),
    ventasRecientes: ventasRecientes.map((v) => ({
      id: v.id, fecha: v.fecha, usuario: v.usuario?.nombre ?? null,
      total: Number(v.total), esCortesia: v.esCortesia,
      pagos: v.pagos.map((p) => ({ metodoPago: p.metodoPago, monto: Number(p.monto) })),
    })),
    ventasPorMetodo: ventasPorMetodoRaw
      .map((v) => ({ metodoPago: v.metodoPago, total: Number(v._sum.monto || 0) }))
      .sort((a, b) => b.total - a.total),
    productosTop,
    stockBajo: stockBajo
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
      .map((p) => ({ id: p.id, nombre: p.nombre, codigoBarras: p.codigoBarras, stock: p.stock, stockMinimo: p.stockMinimo, unidad: p.unidad.nombre })),
  });
}

module.exports = { resumen };
