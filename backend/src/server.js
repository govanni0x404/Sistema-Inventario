require("dotenv").config();
const app = require("./app");
const prisma = require("./lib/prisma");

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, process.env.HOST, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `El puerto ${PORT} ya está en uso. Revisa si la API ya está iniciada.` : error.message);
  process.exitCode = 1;
});

function cerrar() {
  process.removeListener("SIGINT", cerrar);
  process.removeListener("SIGTERM", cerrar);
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
      if (error) throw error;
    } catch (error) {
      console.error("Error al cerrar el servidor", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", cerrar);
process.once("SIGTERM", cerrar);
