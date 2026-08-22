const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { sign } = require("../lib/jwt");
const { permisosDeRol } = require("../lib/permisos");
const { registrarAuditoria } = require("../lib/auditoria");

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

// Bloqueo por cuenta (distinto del rate limit por IP en auth.routes.js): si una cuenta
// puntual acumula demasiadas contraseñas incorrectas en la ventana, se bloquea sin
// importar desde qué IP venga el intento. Se apoya en RegistroAuditoria (ya guarda cada
// login_fallido con usuarioAfectadoId) — sin tabla ni columna nueva. El bloqueo se
// levanta solo cuando los intentos salen de la ventana (no hay estado que resetear).
const LOCKOUT_INTENTOS = 5;
const LOCKOUT_VENTANA_MIN = 15;

async function serializeUsuario(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol.nombre, permisos: await permisosDeRol(u.rol.nombre) };
}

// POST /api/auth/login
async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });
  if (!usuario) {
    await registrarAuditoria(prisma, { accion: "login_fallido", detalle: `correo no registrado: ${email}` });
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }

  const ventanaInicio = new Date(Date.now() - LOCKOUT_VENTANA_MIN * 60 * 1000);
  const intentosFallidos = await prisma.registroAuditoria.count({
    where: {
      accion: "login_fallido",
      usuarioAfectadoId: usuario.id,
      detalle: "contraseña incorrecta",
      fecha: { gte: ventanaInicio },
    },
  });
  if (intentosFallidos >= LOCKOUT_INTENTOS) {
    await registrarAuditoria(prisma, {
      accion: "login_bloqueado",
      usuarioAfectadoId: usuario.id,
      detalle: `bloqueado tras ${intentosFallidos} intentos fallidos en ${LOCKOUT_VENTANA_MIN} min`,
    });
    throw new HttpError(429, "Demasiados intentos fallidos. Esta cuenta está bloqueada temporalmente, intenta de nuevo en unos minutos.");
  }

  const valido = await bcrypt.compare(password, usuario.password);
  if (!valido) {
    await registrarAuditoria(prisma, { accion: "login_fallido", usuarioAfectadoId: usuario.id, detalle: "contraseña incorrecta" });
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }

  if (!usuario.activo) {
    await registrarAuditoria(prisma, { accion: "login_fallido", usuarioAfectadoId: usuario.id, detalle: "cuenta desactivada" });
    throw new HttpError(403, "Tu cuenta está desactivada. Contacta a un administrador.");
  }

  await registrarAuditoria(prisma, { accion: "login_exitoso", usuarioId: usuario.id });
  const token = sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre });
  res.json({ token, usuario: await serializeUsuario(usuario) });
}

// GET /api/auth/me — también revalida permisos en cada carga, así los cambios de un admin
// aplican sin esperar a que expire el token.
async function me(req, res) {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id }, include: { rol: true } });
  if (!usuario) throw new HttpError(401, "Sesión inválida");
  if (!usuario.activo) throw new HttpError(403, "Tu cuenta está desactivada. Contacta a un administrador.");
  res.json(await serializeUsuario(usuario));
}

module.exports = { login, me };
