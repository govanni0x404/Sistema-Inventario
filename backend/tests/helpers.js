const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");
const { sign } = require("../src/lib/jwt");

// Vacía todas las tablas entre tests para que cada uno arranque de un estado limpio y
// conocido. Seguro solo porque apunta a `inventario_test` (forzado por tests/setup.js).
async function resetDb() {
  await prisma.$transaction([
    prisma.registroAuditoria.deleteMany(),
    prisma.devolucionItem.deleteMany(),
    prisma.devolucion.deleteMany(),
    prisma.movimientoStock.deleteMany(),
    prisma.ventaEnEsperaItem.deleteMany(),
    prisma.ventaEnEspera.deleteMany(),
    prisma.ventaItem.deleteMany(),
    prisma.venta.deleteMany(),
    prisma.movimientoCaja.deleteMany(),
    prisma.turnoCaja.deleteMany(),
    prisma.tipoTurno.deleteMany(),
    prisma.historialPrecio.deleteMany(),
    prisma.historialPrecioLista.deleteMany(),
    prisma.precioLista.deleteMany(),
    prisma.listaPrecio.deleteMany(),
    prisma.stockBodega.deleteMany(),
    prisma.bodega.deleteMany(),
    prisma.producto.deleteMany(),
    prisma.proveedor.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.unidad.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.rolPermiso.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.rol.deleteMany(),
  ]);
}

// Las ventas y devoluciones dependen de que exista una bodega principal (ajustarStockBodega
// la busca en cada operación). resetDb() vacía la tabla, así que cualquier test que ejercite
// el flujo de ventas debe llamar a esto en su beforeEach.
async function crearBodegaPrincipal() {
  return prisma.bodega.create({ data: { nombre: "Bodega Principal Test", principal: true } });
}

// Los roles base que la migración siembra en una BD real (admin protegido + cajero). Los
// tests que ejercitan /api/permisos o /api/roles necesitan que existan, ya que resetDb()
// vacía la tabla para que cada test arranque limpio.
async function crearRolesBase() {
  await prisma.rol.createMany({
    data: [
      { nombre: "admin", protegido: true },
      { nombre: "cajero", protegido: false },
    ],
    skipDuplicates: true,
  });
}

let contador = 0;
function siguienteId() {
  contador += 1;
  return contador;
}

// rounds=4 (en vez de los 10 de producción): en tests solo importa la velocidad, no la
// resistencia real a fuerza bruta del hash.
async function crearUsuario({ rol = "cajero", activo = true } = {}) {
  const n = siguienteId();
  const password = await bcrypt.hash("test1234", 4);
  const rolRow = await prisma.rol.upsert({
    where: { nombre: rol },
    update: {},
    create: { nombre: rol, protegido: rol === "admin" },
  });
  const usuario = await prisma.usuario.create({
    data: { nombre: `Test ${rol} ${n}`, email: `test${n}.${rol}@test.local`, password, rolId: rolRow.id, activo },
    include: { rol: true },
  });
  const token = sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre });
  return { usuario, token };
}

async function obtenerOCrearUnidadDefecto() {
  const existente = await prisma.unidad.findFirst({ where: { nombre: "Unidad Test" } });
  if (existente) return existente;
  return prisma.unidad.create({ data: { nombre: "Unidad Test" } });
}

async function crearProducto(overrides = {}) {
  const n = siguienteId();
  const unidadId = overrides.unidadId ?? (await obtenerOCrearUnidadDefecto()).id;
  const producto = await prisma.producto.create({
    data: {
      sku: `SKU-TEST-${n}`,
      nombre: `Producto Test ${n}`,
      precioCompra: 5,
      precioVenta: 10,
      stock: 100,
      stockMinimo: 0,
      ...overrides,
      unidadId,
    },
  });
  // Mantiene StockBodega en sincro con Producto.stock para los tests que ejercitan
  // ventas/devoluciones/movimientos (ver crearBodegaPrincipal). Si aún no existe una
  // bodega principal en este test, no hay nada que sembrar.
  const principal = await prisma.bodega.findFirst({ where: { principal: true } });
  if (principal) {
    await prisma.stockBodega.create({
      data: { bodegaId: principal.id, productoId: producto.id, cantidad: producto.stock },
    });
  }
  return producto;
}

async function crearTipoTurno(nombre = "Turno Test") {
  const n = siguienteId();
  return prisma.tipoTurno.create({ data: { nombre: `${nombre} ${n}` } });
}

module.exports = {
  prisma,
  resetDb,
  crearUsuario,
  crearProducto,
  crearTipoTurno,
  crearRolesBase,
  crearBodegaPrincipal,
};
