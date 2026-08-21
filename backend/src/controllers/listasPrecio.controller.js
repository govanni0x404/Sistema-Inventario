const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { registrarAuditoria } = require("../lib/auditoria");

function serialize(l) {
  return { ...l };
}

function serializePrecio(p) {
  return {
    ...p,
    precio: Number(p.precio),
    producto: p.producto && { ...p.producto, precioVenta: Number(p.producto.precioVenta) },
  };
}

// GET /api/listas-precio?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const listas = await prisma.listaPrecio.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(listas.map(serialize));
}

const crearSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  copiarPrecios: z.boolean().optional().default(false),
});

// POST /api/listas-precio — al crear, el usuario decide si copia los precios actuales
// (punto de partida editable) o arranca vacía (todo usa el precio base hasta que se
// edite explícitamente).
async function crear(req, res) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.listaPrecio.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe una lista de precios con ese nombre");

  const lista = await prisma.$transaction(async (tx) => {
    const creada = await tx.listaPrecio.create({ data: { nombre: parsed.data.nombre } });

    if (parsed.data.copiarPrecios) {
      const productos = await tx.producto.findMany({ where: { activo: true }, select: { id: true, precioVenta: true } });
      if (productos.length > 0) {
        await tx.precioLista.createMany({
          data: productos.map((p) => ({ listaPrecioId: creada.id, productoId: p.id, precio: p.precioVenta })),
        });
      }
    }

    return creada;
  });

  res.status(201).json(serialize(lista));
}

const actualizarSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  activo: z.boolean().optional(),
});

// PUT /api/listas-precio/:id
async function actualizar(req, res) {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.listaPrecio.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Lista de precios no encontrada");

  if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
    const duplicado = await prisma.listaPrecio.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) throw new HttpError(409, "Ya existe una lista de precios con ese nombre");
  }

  const actualizada = await prisma.listaPrecio.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(serialize(actualizada));
}

// DELETE /api/listas-precio/:id — si la lista ya tiene precios propios (o los tuvo
// alguna vez, según su historial), se desactiva en vez de borrarse (mismo patrón que
// Categoría/Unidad/Rol/Tipo de Turno: evita perder en silencio esa configuración de
// precios). Solo se borra de verdad una lista que nunca se llegó a usar.
async function eliminar(req, res) {
  const existente = await prisma.listaPrecio.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Lista de precios no encontrada");

  const [tienePrecios, tieneHistorial] = await Promise.all([
    prisma.precioLista.findFirst({ where: { listaPrecioId: existente.id } }),
    prisma.historialPrecioLista.findFirst({ where: { listaPrecioId: existente.id } }),
  ]);

  if (tienePrecios || tieneHistorial) {
    const desactivada = await prisma.listaPrecio.update({ where: { id: req.params.id }, data: { activo: false } });
    return res.json({ ...serialize(desactivada), _desactivado: true });
  }

  await prisma.listaPrecio.delete({ where: { id: req.params.id } });
  await registrarAuditoria(prisma, {
    accion: "lista_precio_eliminada",
    usuarioId: req.user.id,
    detalle: existente.nombre,
  });
  res.status(204).send();
}

// GET /api/listas-precio/:id/precios — todos los overrides de la lista, con datos del producto.
async function listarPrecios(req, res) {
  const lista = await prisma.listaPrecio.findUnique({ where: { id: req.params.id } });
  if (!lista) throw new HttpError(404, "Lista de precios no encontrada");

  const precios = await prisma.precioLista.findMany({
    where: { listaPrecioId: req.params.id },
    include: { producto: { select: { id: true, nombre: true, sku: true, precioVenta: true } } },
    orderBy: { producto: { nombre: "asc" } },
  });
  res.json(precios.map(serializePrecio));
}

const precioSchema = z.object({
  precio: z.coerce.number().nonnegative("El precio no puede ser negativo"),
});

// PUT /api/listas-precio/:id/precios/:productoId — crea o actualiza el precio del producto en esta lista.
async function guardarPrecio(req, res) {
  const parsed = precioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const lista = await prisma.listaPrecio.findUnique({ where: { id: req.params.id } });
  if (!lista) throw new HttpError(404, "Lista de precios no encontrada");

  const producto = await prisma.producto.findUnique({ where: { id: req.params.productoId } });
  if (!producto) throw new HttpError(404, "Producto no encontrado");

  const anterior = await prisma.precioLista.findUnique({
    where: { listaPrecioId_productoId: { listaPrecioId: req.params.id, productoId: req.params.productoId } },
  });

  const guardado = await prisma.$transaction(async (tx) => {
    const upd = await tx.precioLista.upsert({
      where: { listaPrecioId_productoId: { listaPrecioId: req.params.id, productoId: req.params.productoId } },
      update: { precio: parsed.data.precio },
      create: { listaPrecioId: req.params.id, productoId: req.params.productoId, precio: parsed.data.precio },
      include: { producto: { select: { id: true, nombre: true, sku: true, precioVenta: true } } },
    });
    await tx.historialPrecioLista.create({
      data: {
        listaPrecioId: req.params.id,
        productoId: req.params.productoId,
        precioAnterior: anterior?.precio ?? null,
        precioNuevo: parsed.data.precio,
        usuarioId: req.user?.id,
      },
    });
    return upd;
  });

  res.json(serializePrecio(guardado));
}

// DELETE /api/listas-precio/:id/precios/:productoId — quita el override (vuelve a usar el precio base).
async function quitarPrecio(req, res) {
  const anterior = await prisma.precioLista.findUnique({
    where: { listaPrecioId_productoId: { listaPrecioId: req.params.id, productoId: req.params.productoId } },
  });
  if (!anterior) return res.status(204).send();

  await prisma.$transaction([
    prisma.precioLista.delete({ where: { id: anterior.id } }),
    prisma.historialPrecioLista.create({
      data: {
        listaPrecioId: req.params.id,
        productoId: req.params.productoId,
        precioAnterior: anterior.precio,
        precioNuevo: null,
        usuarioId: req.user?.id,
      },
    }),
  ]);
  res.status(204).send();
}

// GET /api/listas-precio/:id/precios/:productoId/historial
async function historialPrecio(req, res) {
  const historial = await prisma.historialPrecioLista.findMany({
    where: { listaPrecioId: req.params.id, productoId: req.params.productoId },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fecha: "desc" },
  });
  res.json(
    historial.map((h) => ({
      ...h,
      precioAnterior: h.precioAnterior === null ? null : Number(h.precioAnterior),
      precioNuevo: h.precioNuevo === null ? null : Number(h.precioNuevo),
    }))
  );
}

module.exports = { listar, crear, actualizar, eliminar, listarPrecios, guardarPrecio, quitarPrecio, historialPrecio };
