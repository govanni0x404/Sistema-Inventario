const { verify } = require("../lib/jwt");
const HttpError = require("../lib/HttpError");

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "No autenticado"));
  }

  try {
    req.user = verify(header.slice(7));
    next();
  } catch {
    next(new HttpError(401, "Sesión inválida o expirada"));
  }
}

module.exports = auth;
