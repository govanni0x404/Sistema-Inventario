const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const INCLUDE = {
  cliente: { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre: true } },
  items: { include: { producto: { select: { id: true, nombre: true, sku: true, precioVenta: true, stock: true } } } },
};

function serialize(v) {
  return {
    ...v,
    descuento: Number(v.descuento),
    items: v.items.map((it) => ({
      ...it,
      descuento: Number(it.descuento),
      producto: it.producto && { ...it.producto, precioVenta: Number(it.producto.precioVenta) },
    })),
  };
}

const crearSchema = z.object({
  referencia: z.string().trim().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  descuento: z.coerce.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.coerce.number().int().positive(),
        descuento: z.coerce.number().min(0).optional().default(0),
      })
    )
    .min(1, "El carrito está vacío"),
});

// GET /api/ventas-en-espera
async function listar(req, res) {
  const ventas = await prisma.ventaEnEspera.findMany({ include: INCLUDE, orderBy: { creadoEn: "desc" } });
  res.json(ventas.map(serialize));
}

// POST /api/ventas-en-espera — "envía" el carrito actual a la lista de espera.
async function crear(req, res) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { referencia, clienteId, descuento, items } = parsed.data;

  const creada = await prisma.ventaEnEspera.create({
    data: {
      referencia: referencia || null,
      clienteId: clienteId || null,
      descuento,
      usuarioId: req.user?.id,
      items: { create: items },
    },
    include: INCLUDE,
  });
  res.status(201).json(serialize(creada));
}

// DELETE /api/ventas-en-espera/:id — descarta (o se llama tras "recuperar" en el frontend).
async function eliminar(req, res) {
  const existente = await prisma.ventaEnEspera.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Venta en espera no encontrada");

  await prisma.ventaEnEspera.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, crear, eliminar };
