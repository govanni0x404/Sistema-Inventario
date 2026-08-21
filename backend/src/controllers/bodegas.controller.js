const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { ajustarStockBodega } = require("../lib/stockBodega");

const bodegaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  direccion: z.preprocess((v) => (v === "" ? null : v), z.string().trim().nullable().optional()),
  activo: z.boolean().optional(),
});

const transferenciaSchema = z
  .object({
    origenBodegaId: z.string().uuid(),
    destinoBodegaId: z.string().uuid(),
    productoId: z.string().uuid(),
    cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
    motivo: z.string().trim().optional().nullable(),
  })
  .refine((data) => data.origenBodegaId !== data.destinoBodegaId, {
    message: "La bodega de origen y destino no pueden ser la misma",
    path: ["destinoBodegaId"],
  });

// GET /api/bodegas?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const bodegas = await prisma.bodega.findMany({ where, orderBy: [{ principal: "desc" }, { nombre: "asc" }] });
  res.json(bodegas);
}

// GET /api/bodegas/:id/stock
async function stockDeBodega(req, res) {
  const bodega = await prisma.bodega.findUnique({ where: { id: req.params.id } });
  if (!bodega) throw new HttpError(404, "Bodega no encontrada");

  const stocks = await prisma.stockBodega.findMany({
    where: { bodegaId: req.params.id },
    include: { producto: { select: { id: true, nombre: true, sku: true, unidad: { select: { nombre: true } } } } },
    orderBy: { producto: { nombre: "asc" } },
  });

  res.json(stocks);
}

// POST /api/bodegas
async function crear(req, res) {
  const parsed = bodegaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.bodega.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe una bodega con ese nombre");

  const bodega = await prisma.$transaction(async (tx) => {
    const creada = await tx.bodega.create({ data: { ...parsed.data, principal: false } });
    const productos = await tx.producto.findMany({ select: { id: true } });
    if (productos.length > 0) {
      await tx.stockBodega.createMany({
        data: productos.map((p) => ({ bodegaId: creada.id, productoId: p.id, cantidad: 0 })),
      });
    }
    return creada;
  });

  res.status(201).json(bodega);
}

// PUT /api/bodegas/:id — la bodega principal está protegida: no se puede renombrar,
// desactivar ni despojar de su flag `principal` (es donde ocurren las ventas de Caja).
async function actualizar(req, res) {
  const parsed = bodegaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.bodega.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Bodega no encontrada");

  if (existente.principal) {
    if (parsed.data.activo === false) throw new HttpError(400, "La bodega principal no se puede desactivar");
    if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
      throw new HttpError(400, "La bodega principal no se puede renombrar");
    }
  }

  if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
    const duplicado = await prisma.bodega.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) throw new HttpError(409, "Ya existe una bodega con ese nombre");
  }

  const actualizada = await prisma.bodega.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(actualizada);
}

// DELETE /api/bodegas/:id — bloqueada si es la principal o si todavía tiene stock asignado.
async function eliminar(req, res) {
  const existente = await prisma.bodega.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Bodega no encontrada");
  if (existente.principal) throw new HttpError(400, "La bodega principal no se puede eliminar");

  const conStock = await prisma.stockBodega.findFirst({ where: { bodegaId: req.params.id, cantidad: { gt: 0 } } });
  if (conStock) throw new HttpError(409, "No se puede eliminar: la bodega todavía tiene stock asignado");

  await prisma.$transaction([
    prisma.stockBodega.deleteMany({ where: { bodegaId: req.params.id } }),
    prisma.bodega.delete({ where: { id: req.params.id } }),
  ]);
  res.status(204).send();
}

// POST /api/bodegas/transferencias — mueve stock entre dos bodegas; el total del
// producto (Producto.stock) no cambia, solo se redistribuye entre bodegas.
async function transferir(req, res) {
  const parsed = transferenciaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { origenBodegaId, destinoBodegaId, productoId, cantidad, motivo } = parsed.data;

  const movimientos = await prisma.$transaction(async (tx) => {
    const [origen, destino, producto] = await Promise.all([
      tx.bodega.findUnique({ where: { id: origenBodegaId } }),
      tx.bodega.findUnique({ where: { id: destinoBodegaId } }),
      tx.producto.findUnique({ where: { id: productoId } }),
    ]);
    if (!origen) throw new HttpError(404, "Bodega de origen no encontrada");
    if (!destino) throw new HttpError(404, "Bodega de destino no encontrada");
    if (!producto) throw new HttpError(404, "Producto no encontrado");

    const stockOrigenResultante = await ajustarStockBodega(tx, origenBodegaId, productoId, -cantidad);
    const stockDestinoResultante = await ajustarStockBodega(tx, destinoBodegaId, productoId, cantidad);

    const salida = await tx.movimientoStock.create({
      data: {
        productoId,
        tipo: "salida",
        origen: "transferencia",
        cantidad,
        stockResultante: stockOrigenResultante,
        motivo: motivo || `Transferencia a "${destino.nombre}"`,
        usuarioId: req.user?.id,
        bodegaId: origenBodegaId,
      },
    });
    const entrada = await tx.movimientoStock.create({
      data: {
        productoId,
        tipo: "entrada",
        origen: "transferencia",
        cantidad,
        stockResultante: stockDestinoResultante,
        motivo: motivo || `Transferencia desde "${origen.nombre}"`,
        usuarioId: req.user?.id,
        bodegaId: destinoBodegaId,
      },
    });

    return { salida, entrada };
  });

  res.status(201).json(movimientos);
}

module.exports = { listar, stockDeBodega, crear, actualizar, eliminar, transferir };
