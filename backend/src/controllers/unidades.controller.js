const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const unidadSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  activo: z.boolean().optional(),
});

// GET /api/unidades?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const unidades = await prisma.unidad.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(unidades);
}

// POST /api/unidades
async function crear(req, res) {
  const parsed = unidadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.unidad.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe una unidad con ese nombre");

  const unidad = await prisma.unidad.create({ data: parsed.data });
  res.status(201).json(unidad);
}

// PUT /api/unidades/:id
async function actualizar(req, res) {
  const parsed = unidadSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.unidad.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Unidad no encontrada");

  if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
    const duplicado = await prisma.unidad.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) throw new HttpError(409, "Ya existe una unidad con ese nombre");
  }

  const actualizado = await prisma.unidad.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(actualizado);
}

// DELETE /api/unidades/:id — si ya tiene productos asociados, se desactiva en vez de borrarse
// (unidadId es obligatorio en Producto, así que además no podría borrarse por la FK).
async function eliminar(req, res) {
  const existente = await prisma.unidad.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Unidad no encontrada");

  const tieneProductos = await prisma.producto.findFirst({ where: { unidadId: req.params.id } });
  if (tieneProductos) {
    const desactivada = await prisma.unidad.update({ where: { id: req.params.id }, data: { activo: false } });
    return res.json({ ...desactivada, _desactivado: true });
  }

  await prisma.unidad.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };
