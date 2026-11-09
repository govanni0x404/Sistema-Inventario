const HttpError = require("../lib/HttpError");
const { tienePermiso } = require("../lib/permisos");

// requireSeccion("caja") o requireSeccion("caja", "turnos"): con varias secciones,
// basta con tener permiso en UNA de ellas.
function requireSeccion(...secciones) {
  return async (req, res, next) => {
    try {
      let permitido = false;
      for (const seccion of secciones) {
        if (await tienePermiso(req.user.rol, seccion)) {
          permitido = true;
          break;
        }
      }
      if (!permitido) throw new HttpError(403, "No tienes permiso para esta sección");
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireSeccion;
