const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const tipoTurnoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  activo: z.boolean().optional(),
});

// GET /api/tipos-turno?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const tipos = await prisma.tipoTurno.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(tipos);
}

// POST /api/tipos-turno
async function crear(req, res) {
  const parsed = tipoTurnoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.tipoTurno.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe un tipo de turno con ese nombre");

  const tipo = await prisma.tipoTurno.create({ data: parsed.data });
  res.status(201).json(tipo);
}

// PUT /api/tipos-turno/:id
async function actualizar(req, res) {
  const parsed = tipoTurnoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.tipoTurno.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Tipo de turno no encontrado");

  if (parsed.data.nombre && parsed.data.nombre !== existente.nombre) {
    const duplicado = await prisma.tipoTurno.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) throw new HttpError(409, "Ya existe un tipo de turno con ese nombre");
  }

  const actualizado = await prisma.tipoTurno.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(actualizado);
}

// DELETE /api/tipos-turno/:id — si ya tiene turnos asociados, se desactiva en vez de borrarse.
async function eliminar(req, res) {
  const existente = await prisma.tipoTurno.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Tipo de turno no encontrado");

  const tieneTurnos = await prisma.turnoCaja.findFirst({ where: { tipoTurnoId: req.params.id } });
  if (tieneTurnos) {
    const desactivado = await prisma.tipoTurno.update({ where: { id: req.params.id }, data: { activo: false } });
    return res.json({ ...desactivado, _desactivado: true });
  }

  await prisma.tipoTurno.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };
