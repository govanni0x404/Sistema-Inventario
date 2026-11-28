const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { tienePermiso } = require("../lib/permisos");
const { aCentavos, subtotalLineaCentavos } = require("../lib/dinero");

// Compras recientes que se muestran en la ficha del cliente.
const LIMITE_VENTAS_CLIENTE = 50;

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Correo inválido").optional().nullable().or(z.literal("")),
  direccion: z.string().trim().optional().nullable(),
});

const clienteUpdateSchema = clienteSchema.partial();

// GET /api/clientes?q=
async function listar(req, res) {
  const { q } = req.query;
  const where = q
    ? { nombre: { contains: String(q), mode: "insensitive" } }
    : undefined;

  const clientes = await prisma.cliente.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(clientes);
}

// GET /api/clientes/:id  (incluye las últimas compras solo si el rol tiene "historial":
// la ruta queda abierta para Caja, pero las ventas son información de Historial).
async function obtener(req, res) {
  const verVentas = await tienePermiso(req.user.rol, "historial");
  const cliente = await prisma.cliente.findUnique({
    where: { id: req.params.id },
    include: verVentas
      ? {
        ventas: {
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          take: LIMITE_VENTAS_CLIENTE,
          include: { items: true, pagos: true },
        },
      }
      : undefined,
  });
  if (!cliente) throw new HttpError(404, "Cliente no encontrado");

  res.json({
    ...cliente,
    ventas: (cliente.ventas ?? []).map(({ claveIdempotencia, huellaSolicitud, ...v }) => ({
      ...v,
      total: Number(v.total),
      subtotal: (aCentavos(v.total) + aCentavos(v.descuento)) / 100,
      pagos: v.pagos.map((p) => ({ ...p, monto: Number(p.monto) })),
      items: v.items.map(({ costoUnitario, ...it }) => ({
        ...it,
        precioUnitario: Number(it.precioUnitario),
        subtotal: subtotalLineaCentavos(it) / 100,
      })),
    })),
  });
}

// POST /api/clientes
async function crear(req, res) {
  const parsed = clienteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const cliente = await prisma.cliente.create({ data: { ...parsed.data, email: parsed.data.email || null } });
  res.status(201).json(cliente);
}

// PUT /api/clientes/:id
async function actualizar(req, res) {
  const parsed = clienteUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Cliente no encontrado");

  const data = { ...parsed.data };
  if (data.email === "") data.email = null;

  const actualizado = await prisma.cliente.update({ where: { id: req.params.id }, data });
  res.json(actualizado);
}

// DELETE /api/clientes/:id
async function eliminar(req, res) {
  const existente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Cliente no encontrado");

  const tieneVentas = await prisma.venta.findFirst({ where: { clienteId: req.params.id } });
  if (tieneVentas) {
    throw new HttpError(409, "No se puede eliminar: el cliente tiene ventas registradas");
  }
  if (await prisma.cotizacion.findFirst({ where: { clienteId: existente.id }, select: { id: true } })) {
    throw new HttpError(409, "No se puede eliminar: el cliente tiene cotizaciones registradas");
  }

  await prisma.cliente.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
