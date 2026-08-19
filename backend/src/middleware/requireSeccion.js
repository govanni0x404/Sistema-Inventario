const HttpError = require("../lib/HttpError");
const { tienePermiso } = require("../lib/permisos");

function requireSeccion(seccion) {
  return async (req, res, next) => {
    try {
      const permitido = await tienePermiso(req.user.rol, seccion);
      if (!permitido) throw new HttpError(403, "No tienes permiso para esta sección");
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireSeccion;
