const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { firmarSesion } = require("../lib/jwt");
const { permisosDeRol } = require("../lib/permisos");
const { registrarAuditoria } = require("../lib/auditoria");
const { passwordSchema } = require("../lib/password");

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
const CREDENCIALES_INCORRECTAS = "Correo o contraseña incorrectos";

// Hash de relleno: con un correo inexistente igual se ejecuta un bcrypt.compare, para que
// el tiempo de respuesta no revele qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync("relleno-para-igualar-tiempos", 10);

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
  // Sin distinguir mayúsculas: "Admin@Tienda.cl" y "admin@tienda.cl" son la misma cuenta.
  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { rol: true },
  });
  if (!usuario) {
    await bcrypt.compare(password, HASH_RELLENO);
    await registrarAuditoria(prisma, { accion: "login_fallido", detalle: `correo no registrado: ${email}` });
    throw new HttpError(401, CREDENCIALES_INCORRECTAS);
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
  // La contraseña se compara siempre (también con la cuenta bloqueada) y el bloqueo responde
  // igual que una contraseña incorrecta: desde afuera no se distingue si la cuenta existe.
  const valido = await bcrypt.compare(password, usuario.password);
  if (intentosFallidos >= LOCKOUT_INTENTOS) {
    await registrarAuditoria(prisma, {
      accion: "login_bloqueado",
      usuarioAfectadoId: usuario.id,
      detalle: `bloqueado tras ${intentosFallidos} intentos fallidos en ${LOCKOUT_VENTANA_MIN} min`,
    });
    throw new HttpError(401, CREDENCIALES_INCORRECTAS);
  }

  if (!valido) {
    await registrarAuditoria(prisma, { accion: "login_fallido", usuarioAfectadoId: usuario.id, detalle: "contraseña incorrecta" });
    throw new HttpError(401, CREDENCIALES_INCORRECTAS);
  }

  if (!usuario.activo) {
    await registrarAuditoria(prisma, { accion: "login_fallido", usuarioAfectadoId: usuario.id, detalle: "cuenta desactivada" });
    throw new HttpError(403, "Tu cuenta está desactivada. Contacta a un administrador.");
  }
  if (!usuario.rol.activo) {
    await registrarAuditoria(prisma, { accion: "login_fallido", usuarioAfectadoId: usuario.id, detalle: "rol desactivado" });
    throw new HttpError(403, "Tu rol está desactivado. Contacta a un administrador.");
  }

  await registrarAuditoria(prisma, { accion: "login_exitoso", usuarioId: usuario.id });
  const token = firmarSesion(usuario);
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

const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, "Ingresa tu contraseña actual"),
  nueva: passwordSchema,
});

// PUT /api/auth/password — cada usuario cambia SU propia contraseña (pide la actual).
// Invalida todas sus sesiones (tokenVersion + 1) y devuelve un token nuevo para esta.
async function cambiarPassword(req, res) {
  const parsed = cambiarPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { actual, nueva } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!usuario) throw new HttpError(401, "Sesión inválida");
  if (!(await bcrypt.compare(actual, usuario.password))) {
    throw new HttpError(400, "La contraseña actual no es correcta");
  }
  if (actual === nueva) throw new HttpError(400, "La nueva contraseña debe ser distinta a la actual");

  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { password: await bcrypt.hash(nueva, 10), tokenVersion: { increment: 1 } },
    include: { rol: true },
  });
  await registrarAuditoria(prisma, { accion: "password_cambiada", usuarioId: usuario.id, usuarioAfectadoId: usuario.id });
  res.json({ ok: true, token: firmarSesion(actualizado) });
}

async function solicitarRecuperacion(req, res) {
  const parsed = z.string().trim().email().safeParse(req.body?.email);
  if (!parsed.success) return res.status(400).json({ error: "Escribe un correo válido" });
  const usuario = await prisma.usuario.findFirst({
    where: { activo: true, email: { equals: parsed.data, mode: "insensitive" } },
    select: { id: true },
  });
  if (usuario) {
    await registrarAuditoria(prisma, {
      accion: "recuperacion_solicitada",
      usuarioAfectadoId: usuario.id,
      detalle: "Verifica la identidad de la persona antes de restablecer su clave en Usuarios.",
    });
  }
  res.status(202).json({ ok: true });
}

module.exports = { login, me, cambiarPassword, serializeUsuario, solicitarRecuperacion };
