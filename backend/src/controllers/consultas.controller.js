const prisma = require("../lib/prisma");
const { resolverRango, claveDia } = require("../lib/rangoFechas");
const HttpError = require("../lib/HttpError");
const { filtroFolio } = require("../lib/folioVenta");

const LIMITE_DETALLE = 1000;
const CLIENTE = { select: { nombre: true } };

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

  const usuarioIds = [...new Set([...ventasGrupos, ...cortesiasGrupos].map((g) => g.usuarioId))];
  const usuarios = await prisma.usuario.findMany({ where: { id: { in: usuarioIds.filter(Boolean) } }, select: { id: true, nombre: true } });
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const ventasPorUsuarioId = new Map(ventasGrupos.map((g) => [g.usuarioId, g]));
  const cortesiasPorUsuario = new Map(cortesiasGrupos.map((g) => [g.usuarioId, g._count]));

  const filas = usuarioIds
    .map((usuarioId) => {
      const ventas = ventasPorUsuarioId.get(usuarioId);
      return {
        usuarioId,
        nombre: usuarioPorId.get(usuarioId)?.nombre ?? "Sin usuario asignado",
        cantidadVentas: ventas?._count ?? 0,
        total: Number(ventas?._sum.total ?? 0),
        cantidadCortesias: cortesiasPorUsuario.get(usuarioId) ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  res.json({ rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin) }, usuarios: filas });
}

// GET /api/consultas/productos-margen?dias=|desde=&hasta=&limite=
// Margen de los tickets cobrados en el período, con descuentos y antes de reembolsos.
// Las ventas anteriores al registro del costo unitario usan el costo actual como estimación.
async function productosMargen(req, res) {
  const ahora = new Date();
  const { rangoInicio, rangoFin } = resolverRango(req.query, ahora);
  const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 15));

  // Reparte el importe cobrado en centavos usando los mismos pesos y orden que las devoluciones.
  const grupos = await prisma.$queryRaw`
    WITH pesos AS (
      SELECT i.id, i."ventaId", i."productoId", i.cantidad, i."costoUnitario",
             v.total * 100 AS "totalCentavos",
             CASE WHEN SUM(i.subtotal) OVER (PARTITION BY i."ventaId") > 0
                  THEN i.subtotal * 100 ELSE i.cantidad END AS peso
      FROM venta_items i JOIN ventas v ON v.id = i."ventaId"
      WHERE v.fecha BETWEEN (${rangoInicio} AT TIME ZONE 'UTC') AND (${rangoFin} AT TIME ZONE 'UTC')
        AND NOT v."esCortesia"
    ), acumulados AS (
      SELECT *, SUM(peso) OVER (PARTITION BY "ventaId") AS "pesoTotal",
             SUM(peso) OVER (PARTITION BY "ventaId" ORDER BY "productoId", id ROWS UNBOUNDED PRECEDING) AS "pesoAcumulado"
      FROM pesos
    ), importes AS (
      SELECT *, COALESCE(
        div("totalCentavos" * "pesoAcumulado" + div("pesoTotal", 2), NULLIF("pesoTotal", 0)) -
        div("totalCentavos" * ("pesoAcumulado" - peso) + div("pesoTotal", 2), NULLIF("pesoTotal", 0)), 0
      ) / 100 AS ingreso
      FROM acumulados
    )
    SELECT p.id AS "productoId", p.nombre, p.sku, SUM(i.cantidad) AS cantidad,
           SUM(i.ingreso) AS ingreso,
           SUM(COALESCE(i."costoUnitario", p."precioCompra") * i.cantidad) AS costo,
           SUM(i.ingreso - COALESCE(i."costoUnitario", p."precioCompra") * i.cantidad) AS margen,
           BOOL_OR(i."costoUnitario" IS NULL) AS "costoEstimado"
    FROM importes i JOIN productos p ON p.id = i."productoId"
    GROUP BY p.id, p.nombre, p.sku
    ORDER BY margen DESC, p.nombre, p.id
    LIMIT ${limite}
  `;

  const filas = grupos.map(({ cantidad, ingreso, costo, margen, ...producto }) => ({
    ...producto,
    cantidad: Number(cantidad),
    ingreso: Number(ingreso),
    costo: Number(costo),
    margen: Number(margen),
    margenPct: Number(ingreso) > 0 ? (Number(margen) / Number(ingreso)) * 100 : 0,
  }));

  res.json({ rango: { desde: claveDia(rangoInicio), hasta: claveDia(rangoFin) }, productos: filas });
}

async function detallePagos(req, res) {
  const { rangoInicio, rangoFin } = resolverRango(req.query, new Date());
  const { metodo, folio } = req.query;
  if (metodo !== undefined && !["efectivo", "tarjeta", "transferencia"].includes(metodo)) {
    throw new HttpError(400, "Selecciona una forma de pago válida.");
  }
  const fecha = { gte: rangoInicio, lte: rangoFin };
  const venta = { ...filtroFolio(folio), esCortesia: false };
  const datosVenta = { select: { fecha: true, cliente: CLIENTE } };
  const [pagos, reembolsos] = await Promise.all([
    prisma.ventaPago.findMany({
      where: { venta: { ...venta, fecha }, ...(metodo && { metodoPago: metodo }) },
      select: { id: true, ventaId: true, metodoPago: true, monto: true, venta: datosVenta },
      orderBy: [{ venta: { fecha: "desc" } }, { id: "desc" }],
      take: LIMITE_DETALLE + 1,
    }),
    prisma.devolucion.findMany({
      where: { venta, fecha, total: { gt: 0 }, ...(metodo && { metodoReembolso: metodo }) },
      select: { id: true, ventaId: true, metodoReembolso: true, total: true, fecha: true, venta: datosVenta },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: LIMITE_DETALLE + 1,
    }),
  ]);
  const filas = [
    ...pagos.map((p) => ({
      id: p.id, ventaId: p.ventaId, fecha: p.venta.fecha, cliente: p.venta.cliente?.nombre ?? null,
      operacion: "cobro", metodoPago: p.metodoPago, monto: Number(p.monto),
    })),
    ...reembolsos.map((d) => ({
      id: d.id, ventaId: d.ventaId, fecha: d.fecha, cliente: d.venta.cliente?.nombre ?? null,
      operacion: "reembolso", metodoPago: d.metodoReembolso, monto: -Number(d.total),
    })),
  ].sort((a, b) => b.fecha - a.fecha || b.id.localeCompare(a.id));

  res.json({ filas: filas.slice(0, LIMITE_DETALLE), truncado: filas.length > LIMITE_DETALLE });
}

async function detalleProductos(req, res) {
  const { rangoInicio, rangoFin } = resolverRango(req.query, new Date());
  const { producto, folio } = req.query;
  if (producto !== undefined && (typeof producto !== "string" || producto.length > 150)) {
    throw new HttpError(400, "La búsqueda de producto debe tener hasta 150 caracteres.");
  }
  const busqueda = producto?.trim();
  const coincide = { contains: busqueda, mode: "insensitive" };
  const items = await prisma.ventaItem.findMany({
    where: {
      venta: { ...filtroFolio(folio), fecha: { gte: rangoInicio, lte: rangoFin } },
      ...(busqueda && { producto: { OR: [{ nombre: coincide }, { sku: coincide }, { codigoBarras: coincide }] } }),
    },
    select: {
      id: true, ventaId: true, cantidad: true, subtotal: true,
      producto: { select: { nombre: true, sku: true } },
      venta: { select: { fecha: true, esCortesia: true } },
      devolucionItems: { select: { cantidad: true } },
    },
    orderBy: [{ venta: { fecha: "desc" } }, { id: "desc" }],
    take: LIMITE_DETALLE + 1,
  });
  const filas = items.slice(0, LIMITE_DETALLE).map((it) => ({
    id: it.id, ventaId: it.ventaId, fecha: it.venta.fecha, esCortesia: it.venta.esCortesia,
    producto: it.producto.nombre, sku: it.producto.sku, cantidad: it.cantidad,
    cantidadDevuelta: it.devolucionItems.reduce((total, devolucion) => total + devolucion.cantidad, 0),
    subtotal: Number(it.subtotal),
  }));
  res.json({ filas, truncado: items.length > LIMITE_DETALLE });
}

module.exports = { productosTop, ventasPorMetodo, ventasPorUsuario, productosMargen, detallePagos, detalleProductos };
