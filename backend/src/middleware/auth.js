const { verify } = require("../lib/jwt");
const HttpError = require("../lib/HttpError");
const prisma = require("../lib/prisma");

// Además de verificar la firma del JWT, revalida al usuario en la BD en cada request:
// un usuario desactivado (o al que le cambiaron el rol) pierde/cambia el acceso de inmediato,
// sin esperar a que el token expire. El rol se toma de la BD, no del payload del token.
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
      select: { id: true, nombre: true, email: true, activo: true, rol: { select: { nombre: true } } },
    });
    if (!usuario) return next(new HttpError(401, "Sesión inválida"));
    if (!usuario.activo) {
      return next(new HttpError(401, "Tu cuenta está desactivada. Contacta a un administrador."));
    }
    req.user = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;
