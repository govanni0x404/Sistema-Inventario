const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const productosRoutes = require("./routes/productos.routes");
const clientesRoutes = require("./routes/clientes.routes");
const proveedoresRoutes = require("./routes/proveedores.routes");
const ventasRoutes = require("./routes/ventas.routes");
const permisosRoutes = require("./routes/permisos.routes");
const auth = require("./middleware/auth");
const requireAdmin = require("./middleware/requireAdmin");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);

app.use("/api/productos", auth, productosRoutes);
app.use("/api/clientes", auth, clientesRoutes);
app.use("/api/proveedores", auth, proveedoresRoutes);
app.use("/api/ventas", auth, ventasRoutes);
app.use("/api/permisos", auth, requireAdmin, permisosRoutes);

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.use(errorHandler);

module.exports = app;
