// Traduce errores conocidos a respuestas claras; solo lo inesperado queda como 500.
function errorHandler(err, req, res, next) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Errores conocidos de Prisma (https://www.prisma.io/docs/orm/reference/error-reference)
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro no encontrado" });
  }
  if (err.code === "P2002") {
    // Violación de un campo único (SKU, código de barras, email, nombre…).
    const campos = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target;
    return res.status(409).json({ error: `Ya existe un registro con ese valor${campos ? ` (${campos})` : ""}` });
  }
  if (err.code === "P2003") {
    // Llave foránea: se referenció algo que no existe, o se intentó borrar algo que está en uso.
    return res.status(400).json({ error: "Referencia inválida: el registro relacionado no existe o está en uso" });
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}

module.exports = errorHandler;
