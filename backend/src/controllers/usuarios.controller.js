const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { registrarAuditoria } = require("../lib/auditoria");

const usuarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol: z.string().trim().min(1, "Selecciona un rol"),
});

const usuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  rol: z.string().trim().min(1, "Selecciona un rol").optional(),
  activo: z.boolean().optional(),
});

// El backend sigue recibiendo/devolviendo "rol" como el NOMBRE (string) — Usuario.rolId es
// una FK real hacia Rol, pero eso es un detalle interno; se resuelve aquí en cada punto de
// entrada para no tener que tocar el frontend.
async function resolverRol(nombre) {
  const rol = await prisma.rol.findUnique({ where: { nombre } });
  if (!rol) throw new HttpError(400, "Rol inválido");
  return rol;
}

const passwordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

function serialize(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol.nombre, activo: u.activo, creadoEn: u.creadoEn };
}

// GET /api/usuarios
async function listar(req, res) {
  const usuarios = await prisma.usuario.findMany({ include: { rol: true }, orderBy: { nombre: "asc" } });
  res.json(usuarios.map(serialize));
}

// POST /api/usuarios
async function crear(req, res) {
  const parsed = usuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const existente = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  if (existente) return res.status(409).json({ error: "Ya existe un usuario con ese correo" });

  const rol = await resolverRol(parsed.data.rol);

  const password = await bcrypt.hash(parsed.data.password, 10);
  const usuario = await prisma.usuario.create({
    data: { nombre: parsed.data.nombre, email: parsed.data.email, rolId: rol.id, password },
    include: { rol: true },
  });
  res.status(201).json(serialize(usuario));
}

// PUT /api/usuarios/:id
async function actualizar(req, res) {
  const parsed = usuarioUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id }, include: { rol: true } });
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");

  const esUnoMismo = req.params.id === req.user.id;
  if (esUnoMismo && parsed.data.activo === false) {
    throw new HttpError(400, "No puedes desactivar tu propia cuenta");
  }
  if (esUnoMismo && parsed.data.rol && parsed.data.rol !== "admin") {
    throw new HttpError(400, "No puedes quitarte a ti mismo el rol de administrador");
  }

  const { rol: rolNombre, ...resto } = parsed.data;
  const data = { ...resto };
  if (rolNombre && rolNombre !== usuario.rol.nombre) data.rolId = (await resolverRol(rolNombre)).id;

  const actualizado = await prisma.usuario.update({ where: { id: req.params.id }, data, include: { rol: true } });

  if (data.rolId) {
    await registrarAuditoria(prisma, {
      accion: "usuario_rol_cambiado",
      usuarioId: req.user.id,
      usuarioAfectadoId: usuario.id,
      valorAnterior: usuario.rol.nombre,
      valorNuevo: actualizado.rol.nombre,
    });
  }
  if (parsed.data.activo !== undefined && parsed.data.activo !== usuario.activo) {
    await registrarAuditoria(prisma, {
      accion: "usuario_activo_cambiado",
      usuarioId: req.user.id,
      usuarioAfectadoId: usuario.id,
      valorAnterior: String(usuario.activo),
      valorNuevo: String(actualizado.activo),
    });
  }

  res.json(serialize(actualizado));
}

// PUT /api/usuarios/:id/password
async function resetPassword(req, res) {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");

  const password = await bcrypt.hash(parsed.data.password, 10);
  await prisma.usuario.update({ where: { id: req.params.id }, data: { password } });
  await registrarAuditoria(prisma, {
    accion: "password_reseteada",
    usuarioId: req.user.id,
    usuarioAfectadoId: usuario.id,
  });
  res.json({ ok: true });
}

module.exports = { listar, crear, actualizar, resetPassword };
