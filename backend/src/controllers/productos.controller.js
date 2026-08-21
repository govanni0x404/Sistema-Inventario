const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { inicializarStockProducto } = require("../lib/stockBodega");

const productoSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio"),
  codigoBarras: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().trim().min(1).nullable().optional()
  ),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoriaId: z.string().uuid().optional().nullable(),
  precioCompra: z.coerce.number().nonnegative().optional().default(0),
  precioVenta: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative().optional().default(0),
  stockMinimo: z.coerce.number().int().nonnegative().optional().default(0),
  unidadId: z.string().uuid("Selecciona una unidad"),
  proveedorId: z.string().uuid().optional().nullable(),
  activo: z.boolean().optional(),
});

// Esquema de actualización aparte (no derivado de .partial()): los campos con .default() en
// productoSchema aplicarían ese default en cada PUT que los omita, pisando el valor guardado.
// El stock tampoco se actualiza aquí: solo a través de /movimientos, para mantener el registro de auditoría.
const productoUpdateSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio").optional(),
  codigoBarras: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().trim().min(1).nullable().optional()
  ),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  categoriaId: z.string().uuid().optional().nullable(),
  precioCompra: z.coerce.number().nonnegative().optional(),
  precioVenta: z.coerce.number().nonnegative().optional(),
  stockMinimo: z.coerce.number().int().nonnegative().optional(),
  unidadId: z.string().uuid("Selecciona una unidad").optional(),
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
      { categoria: { nombre: { contains: String(q), mode: "insensitive" } } },
      { codigoBarras: { contains: String(q), mode: "insensitive" } },
    ];
  }

  let productos = await prisma.producto.findMany({
    where,
    include: {
      proveedor: { select: { id: true, nombre: true } },
      categoria: { select: { id: true, nombre: true } },
      unidad: { select: { id: true, nombre: true } },
    },
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
    include: {
      proveedor: { select: { id: true, nombre: true } },
      categoria: { select: { id: true, nombre: true } },
      unidad: { select: { id: true, nombre: true } },
    },
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
  if (parsed.data.codigoBarras) {
    const dupBarras = await prisma.producto.findUnique({ where: { codigoBarras: parsed.data.codigoBarras } });
    if (dupBarras) return res.status(409).json({ error: "Ya existe un producto con ese código de barras" });
  }

  const producto = await prisma.$transaction(async (tx) => {
    const creado = await tx.producto.create({
      data: parsed.data,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        categoria: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, nombre: true } },
      },
    });
    await inicializarStockProducto(tx, creado.id, creado.stock);
    return creado;
  });
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
  if (parsed.data.codigoBarras && parsed.data.codigoBarras !== producto.codigoBarras) {
    const dupBarras = await prisma.producto.findUnique({ where: { codigoBarras: parsed.data.codigoBarras } });
    if (dupBarras) return res.status(409).json({ error: "Ya existe un producto con ese código de barras" });
  }

  const cambiaPrecio =
    (parsed.data.precioCompra !== undefined && parsed.data.precioCompra !== Number(producto.precioCompra)) ||
    (parsed.data.precioVenta !== undefined && parsed.data.precioVenta !== Number(producto.precioVenta));

  const actualizado = await prisma.$transaction(async (tx) => {
    const upd = await tx.producto.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        categoria: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, nombre: true } },
      },
    });

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

// Fila de importación masiva: el frontend ya parseó el CSV/Excel a JSON, aquí solo se valida
// y persiste. Si el SKU ya existe se actualiza (sin tocar stock, igual que /:id normal); si no,
// se crea con el stock inicial que traiga la fila.
const filaImportSchema = z.object({
  sku: z.string().trim().min(1, "SKU obligatorio"),
  codigoBarras: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().trim().min(1).nullable().optional()
  ),
  nombre: z.string().trim().min(1, "Nombre obligatorio"),
  categoria: z.preprocess((v) => (v === "" ? null : v), z.string().trim().optional().nullable()),
  precioCompra: z.coerce.number().nonnegative("Precio de compra inválido").optional().default(0),
  precioVenta: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().nonnegative("Precio de venta inválido")
  ),
  stock: z.coerce.number().int().nonnegative("Stock inválido").optional().default(0),
  stockMinimo: z.coerce.number().int().nonnegative("Stock mínimo inválido").optional().default(0),
  unidad: z.preprocess((v) => (v === "" ? null : v), z.string().trim().optional().nullable()),
  proveedor: z.preprocess((v) => (v === "" ? null : v), z.string().trim().optional().nullable()),
});

const importarSchema = z.object({
  productos: z.array(z.record(z.string(), z.unknown())).min(1, "El archivo no tiene filas").max(2000, "Máximo 2000 filas por importación"),
});

// POST /api/productos/importar — recibe filas ya parseadas (CSV/Excel leído en el navegador).
// Se procesa fila por fila (no en una sola transacción) para poder reportar éxito/error por fila.
async function importar(req, res) {
  const parsed = importarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const resultados = [];
  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  // unidadId es obligatorio en Producto: si una fila de creación no trae unidad (o no
  // coincide con ninguna existente), cae en esta por defecto.
  const unidadDefecto =
    (await prisma.unidad.findFirst({ where: { nombre: { equals: "pieza", mode: "insensitive" } } })) ??
    (await prisma.unidad.findFirst({ orderBy: { nombre: "asc" } }));

  for (let i = 0; i < parsed.data.productos.length; i++) {
    const fila = i + 1;
    const raw = parsed.data.productos[i];
    const filaParsed = filaImportSchema.safeParse(raw);

    if (!filaParsed.success) {
      errores++;
      const mensaje = Object.values(filaParsed.error.flatten().fieldErrors).flat().join("; ") || "Datos inválidos";
      resultados.push({ fila, sku: typeof raw.sku === "string" ? raw.sku : null, ok: false, error: mensaje });
      continue;
    }

    const { proveedor: proveedorNombre, categoria: categoriaNombre, unidad: unidadNombre, ...datos } = filaParsed.data;

    try {
      let proveedorId;
      let categoriaId;
      let unidadId;
      const notas = [];
      if (proveedorNombre) {
        const prov = await prisma.proveedor.findFirst({ where: { nombre: { equals: proveedorNombre, mode: "insensitive" } } });
        if (prov) proveedorId = prov.id;
        else notas.push(`Proveedor "${proveedorNombre}" no encontrado, se dejó sin asignar`);
      }
      if (categoriaNombre) {
        const cat = await prisma.categoria.findFirst({ where: { nombre: { equals: categoriaNombre, mode: "insensitive" } } });
        if (cat) categoriaId = cat.id;
        else notas.push(`Categoría "${categoriaNombre}" no encontrada, se dejó sin asignar`);
      }
      if (unidadNombre) {
        const uni = await prisma.unidad.findFirst({ where: { nombre: { equals: unidadNombre, mode: "insensitive" } } });
        if (uni) unidadId = uni.id;
        else notas.push(`Unidad "${unidadNombre}" no encontrada, se usó la unidad por defecto`);
      }
      const nota = notas.length > 0 ? notas.join("; ") : undefined;

      const existente = await prisma.producto.findUnique({ where: { sku: datos.sku } });

      if (existente) {
        if (datos.codigoBarras && datos.codigoBarras !== existente.codigoBarras) {
          const dupBarras = await prisma.producto.findUnique({ where: { codigoBarras: datos.codigoBarras } });
          if (dupBarras) throw new Error(`El código de barras ya pertenece a "${dupBarras.nombre}"`);
        }
        const { stock, ...actualizables } = datos;
        const actualizado = await prisma.producto.update({
          where: { id: existente.id },
          data: {
            ...actualizables,
            ...(proveedorId !== undefined ? { proveedorId } : {}),
            ...(categoriaId !== undefined ? { categoriaId } : {}),
            ...(unidadId !== undefined ? { unidadId } : {}),
          },
        });
        actualizados++;
        resultados.push({ fila, sku: actualizado.sku, ok: true, accion: "actualizado", nota });
      } else {
        if (datos.codigoBarras) {
          const dupBarras = await prisma.producto.findUnique({ where: { codigoBarras: datos.codigoBarras } });
          if (dupBarras) throw new Error(`El código de barras ya pertenece a "${dupBarras.nombre}"`);
        }
        const unidadFinal = unidadId ?? unidadDefecto?.id;
        if (!unidadFinal) throw new Error("No hay unidades configuradas en el sistema");
        const creado = await prisma.$transaction(async (tx) => {
          const p = await tx.producto.create({
            data: { ...datos, proveedorId: proveedorId ?? null, categoriaId: categoriaId ?? null, unidadId: unidadFinal },
          });
          await inicializarStockProducto(tx, p.id, p.stock);
          return p;
        });
        creados++;
        resultados.push({ fila, sku: creado.sku, ok: true, accion: "creado", nota });
      }
    } catch (e) {
      errores++;
      resultados.push({ fila, sku: datos.sku, ok: false, error: e.message || "Error al guardar" });
    }
  }

  res.json({ resumen: { total: parsed.data.productos.length, creados, actualizados, errores }, resultados });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, historialPrecios, importar };
