const jwt = require("jsonwebtoken");

// Valores de ejemplo que nunca deben usarse en producción (vienen de .env.example / .env de desarrollo).
const SECRETOS_INSEGUROS = new Set(["dev_secret_change_me_in_production", "change_me"]);

const JWT_SECRET = process.env.JWT_SECRET;
const EN_PRODUCCION = process.env.NODE_ENV === "production";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Copia backend/.env.example a backend/.env y configúralo.");
}
if (EN_PRODUCCION && (SECRETOS_INSEGUROS.has(JWT_SECRET) || JWT_SECRET.length < 32)) {
  throw new Error(
    "JWT_SECRET usa un valor de desarrollo o es demasiado corto para producción. " +
      "Genera uno nuevo (por ejemplo con `openssl rand -base64 48`) y configúralo como variable de entorno."
  );
}

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

// Token de sesión de un usuario: lleva tokenVersion para que cambiar la contraseña o
// desactivar la cuenta invalide los tokens emitidos antes (ver middleware/auth.js).
function firmarSesion(usuario) {
  return sign({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol.nombre,
    tokenVersion: usuario.tokenVersion ?? 0,
  });
}

function verify(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { sign, verify, firmarSesion };
