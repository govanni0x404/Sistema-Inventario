const { z } = require("zod");

// Política única de contraseñas (usuarios, cambio propio y configuración inicial).
// bcrypt solo considera los primeros 72 bytes: más largo daría una falsa sensación de seguridad.
const passwordSchema = z
  .string({ required_error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar los 72 caracteres")
  .refine((valor) => Buffer.byteLength(valor, "utf8") <= 72, "La contraseña es demasiado larga (usa menos símbolos o tildes)");

module.exports = { passwordSchema };
