function errorHandler(err, req, res, next) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro no encontrado" });
  }

  res.status(500).json({ error: "Error interno del servidor" });
}

module.exports = errorHandler;
