const { randomUUID } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const MAX_STOCK = 2_147_483_647;
const MIN_STOCK = -2_147_483_648;
const cantidad = z.number().int().min(0).max(MAX_STOCK);
const tomaSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(["inventario", "ajuste"]),
  motivo: z.string().trim().min(1).max(300),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    stockEsperado: z.number().int().min(MIN_STOCK).max(MAX_STOCK),
    stockContado: cantidad,
  })).min(1).max(200),
}).superRefine(({ items, tipo }, ctx) => {
  if (new Set(items.map(({ productoId }) => productoId)).size !== items.length) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Cada producto se puede contar una sola vez" });
  }
  if (tipo === "ajuste" && (items.length !== 1 || items[0].stockEsperado === items[0].stockContado)) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "El ajuste debe cambiar el stock de un producto" });
  }
});

async function listar(req, res) {
  const tomas = await prisma.tomaInventario.findMany({
    where: { bodegaId: req.params.id },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true, bodegaId: true, bodegaNombre: true, usuarioNombre: true,
      tipo: true, motivo: true, fecha: true, lineas: true, ajustes: true,
    },
  });
  res.json(tomas);
}

async function obtener(req, res) {
  const toma = await prisma.tomaInventario.findUnique({
    where: { id: req.params.tomaId, bodegaId: req.params.id },
  });
  if (!toma) throw new HttpError(404, "Registro de inventario no encontrado");
  res.json(serializarToma(toma));
}

function serializarToma(toma) {
  return { ...toma, items: toma.items.map(({ sku, codigoBarras = null, ...item }) => ({ ...item, codigoBarras })) };
}

async function registrar(req, res) {
  const parsed = tomaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Revisa las cantidades y el motivo", detalles: parsed.error.flatten() });
  }

  const { id, tipo, motivo, items } = parsed.data;
  const bodegaId = req.params.id;
  const usuarioId = req.user.id;
  const productoIds = items.map(({ productoId }) => productoId);
  const toma = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`toma-inventario:${id}`}, 0))::text`;
    const existente = await tx.tomaInventario.findUnique({ where: { id } });
    if (existente) {
      const previos = new Map(existente.items.map((item) => [item.productoId, item]));
      const coincide = existente.bodegaId === bodegaId && existente.usuarioId === usuarioId
        && existente.tipo === tipo && existente.motivo === motivo && existentesIguales(previos, items);
      if (!coincide) throw new HttpError(409, "Ese código ya corresponde a otra operación de inventario");
      return existente;
    }

    // Caja y transferencias también bloquean el producto antes de cambiar sus existencias.
    const bloqueados = await tx.$queryRaw`
      SELECT "id" FROM "productos" WHERE "id" IN (${Prisma.join(productoIds)})
      ORDER BY "id" COLLATE "C" FOR NO KEY UPDATE
    `;
    if (bloqueados.length !== items.length) throw new HttpError(404, "Uno o más productos ya no existen");
    const [bodega] = await tx.$queryRaw`
      SELECT "nombre", "activo" FROM "bodegas" WHERE "id" = ${bodegaId} FOR SHARE
    `;
    if (!bodega) throw new HttpError(404, "Bodega no encontrada");
    if (!bodega.activo) throw new HttpError(409, "La bodega está inactiva");

    const productos = await tx.producto.findMany({
      where: { id: { in: productoIds } },
      select: {
        id: true, nombre: true, codigoBarras: true, stock: true, unidad: { select: { nombre: true } },
        stockBodegas: { where: { bodegaId }, select: { cantidad: true } },
      },
    });
    const porId = new Map(productos.map((producto) => [producto.id, producto]));
    const detalle = items.map((item) => {
      const producto = porId.get(item.productoId);
      const actual = producto.stockBodegas[0]?.cantidad ?? 0;
      if (actual !== item.stockEsperado) {
        throw new HttpError(409, `Cambió el stock de ${producto.nombre}. Actualiza las existencias y vuelve a verificar el conteo.`);
      }
      return {
        ...item,
        nombre: producto.nombre,
        codigoBarras: producto.codigoBarras,
        unidad: producto.unidad.nombre,
        diferencia: item.stockContado - actual,
      };
    });
    const cambios = detalle.filter(({ diferencia }) => diferencia !== 0).map((item) => {
      const stockTotal = porId.get(item.productoId).stock + item.diferencia;
      if (stockTotal < MIN_STOCK || stockTotal > MAX_STOCK || Math.abs(item.diferencia) > MAX_STOCK) {
        throw new HttpError(409, `El ajuste de ${item.nombre} deja el stock total fuera del rango disponible`);
      }
      return { ...item, stockTotal };
    });

    const creada = await tx.tomaInventario.create({
      data: {
        id, bodegaId, bodegaNombre: bodega.nombre, tipo, motivo, usuarioId, usuarioNombre: req.user.nombre,
        lineas: detalle.length, ajustes: cambios.length, items: detalle,
      },
    });
    if (cambios.length === 0) return creada;

    await tx.$executeRaw`
      UPDATE "productos" AS p
      SET "stock" = v.stock, "actualizadoEn" = CURRENT_TIMESTAMP
      FROM (VALUES ${Prisma.join(cambios.map(({ productoId, stockTotal }) => Prisma.sql`(${productoId}, ${stockTotal}::int)`))}) AS v(id, stock)
      WHERE p."id" = v.id
    `;
    await tx.$executeRaw`
      INSERT INTO "stock_bodega" ("id", "bodegaId", "productoId", "cantidad")
      VALUES ${Prisma.join(cambios.map(({ productoId, stockContado }) => Prisma.sql`(${randomUUID()}, ${bodegaId}, ${productoId}, ${stockContado}::int)`))}
      ON CONFLICT ("bodegaId", "productoId") DO UPDATE SET "cantidad" = EXCLUDED."cantidad"
    `;
    await tx.movimientoStock.createMany({
      data: cambios.map(({ productoId, diferencia, stockTotal }) => ({
        productoId, bodegaId, usuarioId, motivo, origen: tipo,
        tipo: diferencia > 0 ? "entrada" : "salida",
        cantidad: Math.abs(diferencia), stockResultante: stockTotal, tomaInventarioId: creada.id, fecha: creada.fecha,
      })),
    });
    return creada;
  });
  res.status(201).json(serializarToma(toma));
}

function existentesIguales(previos, items) {
  return previos.size === items.length && items.every(({ productoId, stockEsperado, stockContado }) => {
    const previo = previos.get(productoId);
    return previo?.stockEsperado === stockEsperado && previo.stockContado === stockContado;
  });
}

module.exports = { listar, obtener, registrar };
