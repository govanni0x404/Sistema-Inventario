const { Prisma } = require("@prisma/client");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { registrarAuditoria } = require("../lib/auditoria");

const id = z.string().uuid();
const filtros = z.object({
  bodegaId: id.optional(),
  categoriaId: id.optional(),
  proveedorId: id.optional(),
  q: z.string().trim().max(100).optional(),
  estado: z.enum(["faltante", "reponer", "negativo", "sin_costo"]).optional(),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
});

function consulta({ bodegaId, categoriaId, proveedorId, q, estado }) {
  const condiciones = [
    Prisma.sql`((p.activo AND p.inventariable) OR s.cantidad <> 0)`,
    ...(bodegaId ? [Prisma.sql`s."bodegaId" = ${bodegaId}`] : []),
    ...(categoriaId ? [Prisma.sql`p."categoriaId" = ${categoriaId}`] : []),
    ...(proveedorId ? [Prisma.sql`p."proveedorId" = ${proveedorId}`] : []),
    ...(q ? [Prisma.sql`strpos(lower(concat_ws(' ', p.nombre, p.sku, p."codigoBarras")), lower(${q})) > 0`] : []),
  ];
  const estados = {
    faltante: Prisma.sql`"cantidad" <= 0`,
    reponer: Prisma.sql`"sugerido" > 0`,
    negativo: Prisma.sql`"cantidad" < 0`,
    sin_costo: Prisma.sql`"cantidad" <> 0 AND "costoUnitario" = 0`,
  };
  return Prisma.sql`
    WITH recepciones AS (
      SELECT i."itemId", sum(i.cantidad) AS cantidad
      FROM operacion_compra_items i JOIN operaciones_compra op ON op.id = i."operacionId"
      WHERE op."recepcionId" IS NULL
      GROUP BY i."itemId"
    ), pendientes AS (
      SELECT o."bodegaId", i."productoId", sum(i.cantidad - coalesce(r.cantidad, 0)) AS cantidad
      FROM ordenes_compra o JOIN orden_compra_items i ON i."ordenId" = o.id
      LEFT JOIN recepciones r ON r."itemId" = i.id
      WHERE o.estado IN ('emitida', 'parcial') ${bodegaId ? Prisma.sql`AND o."bodegaId" = ${bodegaId}` : Prisma.empty}
      GROUP BY o."bodegaId", i."productoId"
    ), existencias AS (
      SELECT s.id, s."bodegaId", b.nombre AS "bodegaNombre", b.activo AS "bodegaActiva",
        s."productoId", p.nombre AS "productoNombre", p.activo AND p.inventariable AS "productoOperativo",
        p.sku, p."codigoBarras", c.nombre AS categoria, p."proveedorId", v.nombre AS "proveedorNombre",
        s.cantidad, s."stockMinimo" AS "minimoConfigurado",
        coalesce(s."stockMinimo", CASE WHEN b.principal THEN p."stockMinimo" ELSE 0 END) AS minimo,
        coalesce(pen.cantidad, 0) AS pendiente,
        p."precioCompra" AS "costoUnitario",
        p."precioCompra" * s.cantidad AS valor
      FROM stock_bodega s
      JOIN productos p ON p.id = s."productoId"
      JOIN bodegas b ON b.id = s."bodegaId"
      LEFT JOIN categorias c ON c.id = p."categoriaId"
      LEFT JOIN proveedores v ON v.id = p."proveedorId"
      LEFT JOIN pendientes pen ON pen."bodegaId" = s."bodegaId" AND pen."productoId" = s."productoId"
      WHERE ${Prisma.join(condiciones, " AND ")}
    ), reposicion AS (
      SELECT *, CASE WHEN "bodegaActiva" AND "productoOperativo"
        THEN greatest(0, minimo::bigint - cantidad - pendiente) ELSE 0 END AS sugerido
      FROM existencias
    ), filtradas AS (
      SELECT * FROM reposicion ${estado ? Prisma.sql`WHERE ${estados[estado]}` : Prisma.empty}
    )
  `;
}

async function listar(req, res) {
  const datos = filtros.safeParse(req.query);
  if (!datos.success) throw new HttpError(400, "Revisa los filtros del inventario");
  const informe = consulta(datos.data);
  const filasPorPagina = 40;
  const orden = Prisma.sql`ORDER BY "productoNombre", "bodegaNombre", id`;
  const filas = Prisma.sql`
    SELECT id, "bodegaId", "bodegaNombre", "bodegaActiva", "productoId", "productoNombre", "productoOperativo",
      sku, "codigoBarras", categoria, "proveedorId", "proveedorNombre", cantidad, "minimoConfigurado", minimo,
      pendiente::text, sugerido::text, "costoUnitario"::text, valor::text
    FROM filtradas ${orden}
  `;
  if (req.query.exportar === "true") {
    const registros = await prisma.$queryRaw`${informe} ${filas}`;
    return res.json(registros);
  }
  const [[resumen], registros] = await prisma.$transaction([
    prisma.$queryRaw`
      ${informe}
      SELECT count(*)::integer AS total, coalesce(sum(cantidad), 0)::text AS unidades,
        coalesce(sum(valor), 0)::text AS valor, count(*) FILTER (WHERE sugerido > 0)::integer AS reponer,
        count(*) FILTER (WHERE cantidad < 0)::integer AS negativos
      FROM filtradas
    `,
    prisma.$queryRaw`${informe} ${filas} LIMIT ${filasPorPagina} OFFSET ${(datos.data.pagina - 1) * filasPorPagina}`,
  ], { isolationLevel: "RepeatableRead" });
  res.json({ resumen, filas: registros, filasPorPagina });
}

async function cambiarMinimo(req, res) {
  const parsed = z.object({
    bodegaId: id,
    productoId: id,
    stockMinimo: z.number().int().nonnegative().max(2_147_483_647).nullable(),
  }).safeParse({ ...req.body, ...req.params });
  if (!parsed.success) throw new HttpError(400, "Ingresa un mínimo entero mayor o igual a cero o restablece el valor");
  const { bodegaId, productoId, stockMinimo } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const [producto] = await tx.$queryRaw`SELECT nombre, activo, inventariable FROM productos WHERE id = ${productoId} FOR NO KEY UPDATE`;
    if (!producto?.activo || !producto.inventariable) throw new HttpError(409, "Selecciona un producto activo con control de inventario");
    const [bodega] = await tx.$queryRaw`SELECT nombre, activo FROM bodegas WHERE id = ${bodegaId} FOR SHARE`;
    if (!bodega?.activo) throw new HttpError(409, "Selecciona una bodega activa");
    const where = { bodegaId_productoId: { bodegaId, productoId } };
    const anterior = await tx.stockBodega.findUnique({ where, select: { stockMinimo: true } });
    if (!anterior) throw new HttpError(404, "No existe el producto en el inventario de la bodega");
    if (anterior.stockMinimo === stockMinimo) return;
    await tx.stockBodega.update({ where, data: { stockMinimo } });
    await registrarAuditoria(tx, {
      accion: "stock_minimo_actualizado", usuarioId: req.user.id,
      valorAnterior: anterior.stockMinimo?.toString(), valorNuevo: stockMinimo?.toString(),
      detalle: `${producto.nombre} · ${bodega.nombre}`,
    });
  });
  res.status(204).send();
}

module.exports = { listar, cambiarMinimo };
