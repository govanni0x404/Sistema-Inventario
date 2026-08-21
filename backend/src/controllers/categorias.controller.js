const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  activo: z.boolean().optional(),
});

// GET /api/categorias?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const categorias = await prisma.categoria.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(categorias);
}

// POST /api/categorias
async function crear(req, res) {
  const parsed = categoriaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.categoria.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe una categoría con ese nombre");

  const categoria = await prisma.categoria.create({ data: parsed.data });
  res.status(201).json(categoria);
}

// PUT /api/categorias/:id
async function actualizar(req, res) {
  const parsed = categoriaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.categoria.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Categoría no encontrada");

  if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
    const duplicado = await prisma.categoria.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) throw new HttpError(409, "Ya existe una categoría con ese nombre");
  }

  const actualizado = await prisma.categoria.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(actualizado);
}

// DELETE /api/categorias/:id — si ya tiene productos asociados, se desactiva en vez de borrarse.
async function eliminar(req, res) {
  const existente = await prisma.categoria.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Categoría no encontrada");

  const tieneProductos = await prisma.producto.findFirst({ where: { categoriaId: req.params.id } });
  if (tieneProductos) {
    const desactivada = await prisma.categoria.update({ where: { id: req.params.id }, data: { activo: false } });
    return res.json({ ...desactivada, _desactivado: true });
  }

  await prisma.categoria.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };
