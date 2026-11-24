const express = require("express");
const cors = require("cors");
const { existsSync } = require("node:fs");
const path = require("node:path");

const authRoutes = require("./routes/auth.routes");
const productosRoutes = require("./routes/productos.routes");
const clientesRoutes = require("./routes/clientes.routes");
const proveedoresRoutes = require("./routes/proveedores.routes");
const ventasRoutes = require("./routes/ventas.routes");
const permisosRoutes = require("./routes/permisos.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const turnosRoutes = require("./routes/turnos.routes");
const tiposTurnoRoutes = require("./routes/tiposTurno.routes");
const categoriasRoutes = require("./routes/categorias.routes");
const unidadesRoutes = require("./routes/unidades.routes");
const rolesRoutes = require("./routes/roles.routes");
const ventasEnEsperaRoutes = require("./routes/ventasEnEspera.routes");
const movimientosCajaRoutes = require("./routes/movimientosCaja.routes");
const listasPrecioRoutes = require("./routes/listasPrecio.routes");
const consultasRoutes = require("./routes/consultas.routes");
const bodegasRoutes = require("./routes/bodegas.routes");
const auditoriaRoutes = require("./routes/auditoria.routes");
const negocioRoutes = require("./routes/negocio.routes");
const setupRoutes = require("./routes/setup.routes");
const auth = require("./middleware/auth");
const requireAdmin = require("./middleware/requireAdmin");
const errorHandler = require("./middleware/errorHandler");
const prisma = require("./lib/prisma");

const app = express();
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const frontendIndex = path.join(frontendDist, "index.html");

// Solo se confía en cabeceras reenviadas al configurar los proxies que preceden al servidor.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isSafeInteger(proxyHops) || proxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS debe ser un entero mayor o igual a cero.");
}
app.set("trust proxy", proxyHops);

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "5mb" })); // filas de importación masiva de productos pueden superar el límite por defecto

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/ready", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: "Base de datos no disponible" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/setup", setupRoutes);

app.use("/api/productos", auth, productosRoutes);
app.use("/api/clientes", auth, clientesRoutes);
app.use("/api/proveedores", auth, proveedoresRoutes);
app.use("/api/ventas", auth, ventasRoutes);
app.use("/api/permisos", auth, requireAdmin, permisosRoutes);
app.use("/api/usuarios", auth, requireAdmin, usuariosRoutes);
app.use("/api/dashboard", auth, dashboardRoutes);
app.use("/api/turnos", auth, turnosRoutes);
app.use("/api/cajas", auth, require("./routes/cajas.routes"));
app.use("/api/tipos-turno", auth, tiposTurnoRoutes);
app.use("/api/categorias", auth, categoriasRoutes);
app.use("/api/unidades", auth, unidadesRoutes);
app.use("/api/roles", auth, rolesRoutes);
app.use("/api/ventas-en-espera", auth, ventasEnEsperaRoutes);
app.use("/api/movimientos-caja", auth, movimientosCajaRoutes);
app.use("/api/listas-precio", auth, listasPrecioRoutes);
app.use("/api/consultas", auth, consultasRoutes);
app.use("/api/bodegas", auth, bodegasRoutes);
app.use("/api/auditoria", auth, requireAdmin, auditoriaRoutes);
app.use("/api/negocio", auth, negocioRoutes);

function notFound(req, res) {
  res.status(404).json({ error: "Ruta no encontrada" });
}

app.use("/api", notFound);

if (existsSync(frontendIndex)) {
  app.use("/assets", express.static(path.join(frontendDist, "assets"), {
    immutable: true,
    maxAge: "1y",
  }), notFound);
  app.use(express.static(frontendDist, { index: false }));
  app.get("*", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) return next();
    res.sendFile(frontendIndex, { cacheControl: false, headers: { "Cache-Control": "no-cache" } });
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
