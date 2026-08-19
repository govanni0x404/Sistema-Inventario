const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const productoSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoria: z.string().trim().optional().nullable(),
  precioCompra: z.coerce.number().nonnegative().optional().default(0),
  precioVenta: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative().optional().default(0),
  stockMinimo: z.coerce.number().int().nonnegative().optional().default(0),
  unidad: z.string().trim().optional().default("unidad"),
  proveedorId: z.string().uuid().optional().nullable(),
  activo: z.boolean().optional(),
});

// Esquema de actualización aparte (no derivado de .partial()): los campos con .default() en
// productoSchema aplicarían ese default en cada PUT que los omita, pisando el valor guardado.
// El stock tampoco se actualiza aquí: solo a través de /movimientos, para mantener el registro de auditoría.
const productoUpdateSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio").optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  categoria: z.string().trim().optional().nullable(),
  precioCompra: z.coerce.number().nonnegative().optional(),
  precioVenta: z.coerce.number().nonnegative().optional(),
  stockMinimo: z.coerce.number().int().nonnegative().optional(),
  unidad: z.string().trim().optional(),
  proveedorId: z.string().uuid().optional().nullable(),
  activo: z.boolean().optional(),
});

function serialize(producto) {
  return {
    ...producto,
    precioCompra: Number(producto.precioCompra),
    precioVenta: Number(producto.precioVenta),
  };
}

// GET /api/productos?q=&stockBajo=&activo=
async function listar(req, res) {
  const { q, stockBajo, activo } = req.query;

  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;
  if (q) {
    where.OR = [
      { nombre: { contains: String(q), mode: "insensitive" } },
      { sku: { contains: String(q), mode: "insensitive" } },
      { categoria: { contains: String(q), mode: "insensitive" } },
    ];
  }

  let productos = await prisma.producto.findMany({
    where,
    include: { proveedor: { select: { id: true, nombre: true } } },
    orderBy: { nombre: "asc" },
  });

  if (stockBajo === "true") {
    productos = productos.filter((p) => p.stock <= p.stockMinimo);
  }

  res.json(productos.map(serialize));
}

// GET /api/productos/:id
async function obtener(req, res) {
  const producto = await prisma.producto.findUnique({
    where: { id: req.params.id },
    include: { proveedor: { select: { id: true, nombre: true } } },
  });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(serialize(producto));
}

// POST /api/productos
async function crear(req, res) {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.producto.findUnique({ where: { sku: parsed.data.sku } });
  if (existente) {
    return res.status(409).json({ error: "Ya existe un producto con ese SKU" });
  }

  const producto = await prisma.producto.create({ data: parsed.data });
  res.status(201).json(serialize(producto));
}

// PUT /api/productos/:id
async function actualizar(req, res) {
  const parsed = productoUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  if (parsed.data.sku && parsed.data.sku !== producto.sku) {
    const duplicado = await prisma.producto.findUnique({ where: { sku: parsed.data.sku } });
    if (duplicado) return res.status(409).json({ error: "Ya existe un producto con ese SKU" });
  }

  const cambiaPrecio =
    (parsed.data.precioCompra !== undefined && parsed.data.precioCompra !== Number(producto.precioCompra)) ||
    (parsed.data.precioVenta !== undefined && parsed.data.precioVenta !== Number(producto.precioVenta));

  const actualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.producto.update({ where: { id: req.params.id }, data: parsed.data });

    if (cambiaPrecio) {
      await tx.historialPrecio.create({
        data: {
          productoId: producto.id,
          precioCompraAnterior: producto.precioCompra,
          precioCompraNuevo: upd.precioCompra,
          precioVentaAnterior: producto.precioVenta,
          precioVentaNuevo: upd.precioVenta,
          usuarioId: req.user?.id,
        },
      });
    }

    return upd;
  });

  res.json(serialize(actualizado));
}

// GET /api/productos/:id/historial-precios
async function historialPrecios(req, res) {
  const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
  if (!producto) throw new HttpError(404, "Producto no encontrado");

  const historial = await prisma.historialPrecio.findMany({
    where: { productoId: req.params.id },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  res.json(
    historial.map((h) => ({
      ...h,
      precioCompraAnterior: Number(h.precioCompraAnterior),
      precioCompraNuevo: Number(h.precioCompraNuevo),
      precioVentaAnterior: Number(h.precioVentaAnterior),
      precioVentaNuevo: Number(h.precioVentaNuevo),
    }))
  );
}

// DELETE /api/productos/:id
// Si el producto ya tiene ventas asociadas, se desactiva en lugar de borrarse físicamente.
async function eliminar(req, res) {
  const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  const tieneVentas = await prisma.ventaItem.findFirst({ where: { productoId: req.params.id } });

  if (tieneVentas) {
    const desactivado = await prisma.producto.update({
      where: { id: req.params.id },
      data: { activo: false },
    });
    return res.json({ ...serialize(desactivado), _desactivado: true });
  }

  await prisma.producto.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, obtener, crear, actualizar, eliminar, historialPrecios };
