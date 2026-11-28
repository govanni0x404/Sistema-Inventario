const { verify } = require("../lib/jwt");
const HttpError = require("../lib/HttpError");
const prisma = require("../lib/prisma");

// Además de verificar la firma del JWT, revalida al usuario en la BD en cada request:
// un usuario desactivado (o al que le cambiaron el rol) pierde/cambia el acceso de inmediato,
// sin esperar a que el token expire. El rol se toma de la BD, no del payload del token.
// También rechaza tokens de una versión de sesión anterior (contraseña cambiada, cuenta
// desactivada) y a usuarios cuyo rol fue desactivado.
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "No autenticado"));
  }

  let payload;
  try {
    payload = verify(header.slice(7));
  } catch {
    return next(new HttpError(401, "Sesión inválida o expirada"));
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: {
        id: true, nombre: true, email: true, activo: true, tokenVersion: true,
        rol: { select: { nombre: true, activo: true } },
      },
    });
    if (!usuario) return next(new HttpError(401, "Sesión inválida"));
    if (!usuario.activo) {
      return next(new HttpError(401, "Tu cuenta está desactivada. Contacta a un administrador."));
    }
    // Tokens anteriores a tokenVersion no traen el campo: cuentan como versión 0.
    if ((payload.tokenVersion ?? 0) !== usuario.tokenVersion) {
      return next(new HttpError(401, "Tu sesión ya no es válida. Inicia sesión de nuevo."));
    }
    if (!usuario.rol.activo) {
      return next(new HttpError(403, "Tu rol está desactivado. Contacta a un administrador."));
    }
    req.user = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;
