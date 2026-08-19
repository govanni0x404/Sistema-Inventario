const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Correo inválido").optional().nullable().or(z.literal("")),
  contacto: z.string().trim().optional().nullable(),
});

const proveedorUpdateSchema = proveedorSchema.partial();

function serializeProducto(p) {
  return { ...p, precioCompra: Number(p.precioCompra), precioVenta: Number(p.precioVenta) };
}

// GET /api/proveedores?q=
async function listar(req, res) {
  const { q } = req.query;
  const where = q
    ? { nombre: { contains: String(q), mode: "insensitive" } }
    : undefined;

  const proveedores = await prisma.proveedor.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(proveedores);
}

// GET /api/proveedores/:id  (incluye productos asociados)
async function obtener(req, res) {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: req.params.id },
    include: { productos: { orderBy: { nombre: "asc" } } },
  });
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado");

  res.json({ ...proveedor, productos: proveedor.productos.map(serializeProducto) });
}

// POST /api/proveedores
async function crear(req, res) {
  const parsed = proveedorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const proveedor = await prisma.proveedor.create({ data: { ...parsed.data, email: parsed.data.email || null } });
  res.status(201).json(proveedor);
}

// PUT /api/proveedores/:id
async function actualizar(req, res) {
  const parsed = proveedorUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.proveedor.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Proveedor no encontrado");

  const data = { ...parsed.data };
  if (data.email === "") data.email = null;

  const actualizado = await prisma.proveedor.update({ where: { id: req.params.id }, data });
  res.json(actualizado);
}

// DELETE /api/proveedores/:id
async function eliminar(req, res) {
  const existente = await prisma.proveedor.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Proveedor no encontrado");

  const tieneProductos = await prisma.producto.findFirst({ where: { proveedorId: req.params.id } });
  if (tieneProductos) {
    throw new HttpError(409, "No se puede eliminar: el proveedor tiene productos asociados");
  }

  await prisma.proveedor.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
