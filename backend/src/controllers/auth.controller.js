const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { sign } = require("../lib/jwt");
const { permisosDeRol } = require("../lib/permisos");

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

async function serializeUsuario(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, permisos: await permisosDeRol(u.rol) };
}

// POST /api/auth/login
async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new HttpError(401, "Correo o contraseña incorrectos");

  const valido = await bcrypt.compare(password, usuario.password);
  if (!valido) throw new HttpError(401, "Correo o contraseña incorrectos");

  const token = sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol });
  res.json({ token, usuario: await serializeUsuario(usuario) });
}

// GET /api/auth/me — también revalida permisos en cada carga, así los cambios de un admin
// aplican sin esperar a que expire el token.
async function me(req, res) {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!usuario) throw new HttpError(401, "Sesión inválida");
  res.json(await serializeUsuario(usuario));
}

module.exports = { login, me };
