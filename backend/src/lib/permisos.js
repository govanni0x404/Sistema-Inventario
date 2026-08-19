const prisma = require("./prisma");

// Debe reflejar las secciones de navegación del frontend.
const SECCIONES = ["dashboard", "caja", "turnos", "productos", "stock", "bodega", "precios", "clientes", "proveedores", "historial"];

// Roles a los que aplica el sistema de permisos. "admin" queda fuera a propósito: siempre
// tiene acceso total, así nunca puede bloquearse a sí mismo (ni a esta misma pantalla).
const ROLES_CONFIGURABLES = ["cajero"];

// Sin fila en la tabla = permitido por defecto, así nada se rompe hasta que un admin restrinja algo.
async function permisosDeRol(rol) {
  if (rol === "admin") {
    return Object.fromEntries(SECCIONES.map((s) => [s, true]));
  }
  const filas = await prisma.rolPermiso.findMany({ where: { rol } });
  const mapa = Object.fromEntries(filas.map((f) => [f.seccion, f.permitido]));
  return Object.fromEntries(SECCIONES.map((s) => [s, mapa[s] !== undefined ? mapa[s] : true]));
}

async function tienePermiso(rol, seccion) {
  if (rol === "admin") return true;
  const fila = await prisma.rolPermiso.findUnique({ where: { rol_seccion: { rol, seccion } } });
  return fila ? fila.permitido : true;
}

module.exports = { SECCIONES, ROLES_CONFIGURABLES, permisosDeRol, tienePermiso };
