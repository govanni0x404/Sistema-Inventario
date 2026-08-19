const HttpError = require("../lib/HttpError");

function requireAdmin(req, res, next) {
  if (req.user?.rol !== "admin") {
    return next(new HttpError(403, "Solo un administrador puede acceder a esta sección"));
  }
  next();
}

module.exports = requireAdmin;
