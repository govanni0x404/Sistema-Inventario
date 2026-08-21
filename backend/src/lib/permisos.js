const prisma = require("./prisma");

// Debe reflejar las secciones de navegación del frontend.
const SECCIONES = ["dashboard", "caja", "turnos", "productos", "stock", "bodega", "precios", "clientes", "proveedores", "historial", "consultas"];

// Sin fila en la tabla = permitido por defecto, así nada se rompe hasta que un admin restrinja algo.
// Recibe el NOMBRE del rol (así lo lleva el JWT) y lo resuelve a su id internamente —
// RolPermiso.rolId es una FK real, no un string libre.
async function permisosDeRol(rolNombre) {
  if (rolNombre === "admin") {
    return Object.fromEntries(SECCIONES.map((s) => [s, true]));
  }
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  if (!rol) return Object.fromEntries(SECCIONES.map((s) => [s, true]));
  const filas = await prisma.rolPermiso.findMany({ where: { rolId: rol.id } });
  const mapa = Object.fromEntries(filas.map((f) => [f.seccion, f.permitido]));
  return Object.fromEntries(SECCIONES.map((s) => [s, mapa[s] !== undefined ? mapa[s] : true]));
}

async function tienePermiso(rolNombre, seccion) {
  if (rolNombre === "admin") return true;
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  if (!rol) return true;
  const fila = await prisma.rolPermiso.findUnique({ where: { rolId_seccion: { rolId: rol.id, seccion } } });
  return fila ? fila.permitido : true;
}

module.exports = { SECCIONES, permisosDeRol, tienePermiso };
