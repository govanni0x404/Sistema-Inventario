const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { registrarAuditoria } = require("../lib/auditoria");

const rolSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  activo: z.boolean().optional(),
});

function esAdmin(nombre) {
  return nombre.trim().toLowerCase() === "admin";
}

// GET /api/roles?activo=true
async function listar(req, res) {
  const { activo } = req.query;
  const where = {};
  if (activo === "true") where.activo = true;
  if (activo === "false") where.activo = false;

  const roles = await prisma.rol.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(roles);
}

// POST /api/roles
async function crear(req, res) {
  const parsed = rolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  if (esAdmin(parsed.data.nombre)) throw new HttpError(409, '"admin" ya existe y es un rol protegido');

  const existente = await prisma.rol.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) throw new HttpError(409, "Ya existe un rol con ese nombre");

  const rol = await prisma.rol.create({ data: parsed.data });
  res.status(201).json(rol);
}

// PUT /api/roles/:id — Usuario.rolId y RolPermiso.rolId son FK reales hacia acá, así que
// renombrar un rol se refleja solo en todo lo que lo referencia (ya no hace falta
// propagar el cambio a mano con updateMany).
async function actualizar(req, res) {
  const parsed = rolSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.rol.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Rol no encontrado");
  if (existente.protegido) throw new HttpError(400, "Este rol está protegido y no se puede modificar");

  const nuevoNombre = parsed.data.nombre;
  const cambiaNombre = nuevoNombre && nuevoNombre !== existente.nombre;

  if (cambiaNombre) {
    if (esAdmin(nuevoNombre)) throw new HttpError(409, '"admin" es un nombre de rol protegido');
    const duplicado = await prisma.rol.findUnique({ where: { nombre: nuevoNombre } });
    if (duplicado) throw new HttpError(409, "Ya existe un rol con ese nombre");
  }

  const actualizado = await prisma.rol.update({ where: { id: req.params.id }, data: parsed.data });

  if (cambiaNombre) {
    await registrarAuditoria(prisma, {
      accion: "rol_renombrado",
      usuarioId: req.user.id,
      valorAnterior: existente.nombre,
      valorNuevo: actualizado.nombre,
    });
  }

  res.json(actualizado);
}

// DELETE /api/roles/:id — si ya hay usuarios con este rol, se desactiva en vez de
// borrarse (evita dejar usuarios con un rol que ya no existe en el catálogo). Si se borra
// de verdad, sus RolPermiso van con él por cascade (ver schema.prisma).
async function eliminar(req, res) {
  const existente = await prisma.rol.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new HttpError(404, "Rol no encontrado");
  if (existente.protegido) throw new HttpError(400, "Este rol está protegido y no se puede eliminar");

  const enUso = await prisma.usuario.findFirst({ where: { rolId: existente.id } });
  if (enUso) {
    const desactivado = await prisma.rol.update({ where: { id: req.params.id }, data: { activo: false } });
    return res.json({ ...desactivado, _desactivado: true });
  }

  await prisma.rol.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listar, crear, actualizar, eliminar };
