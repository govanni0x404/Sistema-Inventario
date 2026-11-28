const prisma = require("./prisma");

// Debe reflejar las secciones de navegación del frontend.
const SECCIONES = ["dashboard", "caja", "turnos", "productos", "stock", "bodega", "precios", "clientes", "proveedores", "historial", "consultas", "compras", "planificacion"];

// Conserva el acceso previo. Las secciones nuevas con costos requieren habilitación explícita.
// Recibe el NOMBRE del rol (así lo lleva el JWT) y lo resuelve a su id internamente —
// RolPermiso.rolId es una FK real, no un string libre.
async function permisosDeRol(rolNombre) {
  if (rolNombre === "admin") {
    return Object.fromEntries(SECCIONES.map((s) => [s, true]));
  }
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  const filas = rol ? await prisma.rolPermiso.findMany({ where: { rolId: rol.id } }) : [];
  const mapa = Object.fromEntries(filas.map((f) => [f.seccion, f.permitido]));
  return Object.fromEntries(SECCIONES.map((s) => [s, mapa[s] ?? permisoInicial(s)]));
}

function permisoInicial(seccion) {
  return !["compras", "planificacion"].includes(seccion);
}

async function tienePermiso(rolNombre, seccion) {
  if (rolNombre === "admin") return true;
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  if (!rol) return permisoInicial(seccion);
  const fila = await prisma.rolPermiso.findUnique({ where: { rolId_seccion: { rolId: rol.id, seccion } } });
  return fila?.permitido ?? permisoInicial(seccion);
}

module.exports = { SECCIONES, permisosDeRol, tienePermiso, permisoInicial };
