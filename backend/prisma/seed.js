const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.rol.upsert({
    where: { nombre: "admin" },
    update: {},
    create: { nombre: "admin", protegido: true },
  });
  const cajero = await prisma.rol.upsert({
    where: { nombre: "cajero" },
    update: {},
    create: { nombre: "cajero" },
  });

  const usuarios = [
    { email: "admin@inventario.local", nombre: "Administrador", password: "admin123", rolId: admin.id },
    { email: "cajero@inventario.local", nombre: "Cajero", password: "cajero123", rolId: cajero.id },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash(u.password, 10) },
    });
  }

  const distribuidora = await prisma.proveedor.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nombre: "Distribuidora del Centro",
      telefono: "555-900-1122",
      email: "ventas@distcentro.com",
      contacto: "Jorge Ramírez",
    },
  });

  // Catálogos que el producto necesita como FK (categoría opcional, unidad obligatoria).
  const unidadPieza = await prisma.unidad.upsert({ where: { nombre: "Pieza" }, update: {}, create: { nombre: "Pieza" } });
  const categorias = {};
  for (const nombre of ["Abarrotes", "Bebidas", "Limpieza"]) {
    categorias[nombre] = await prisma.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // La migración de bodegas crea "Bodega Principal"; si la BD se creó de otra forma, se asegura aquí.
  let principal = await prisma.bodega.findFirst({ where: { principal: true } });
  if (!principal) {
    principal = await prisma.bodega.create({ data: { nombre: "Bodega Principal", principal: true } });
  }

  const productos = [
    { sku: "AB-001", nombre: "Arroz 1kg", categoria: "Abarrotes", precioCompra: 18, precioVenta: 25, stock: 40, stockMinimo: 10 },
    { sku: "AB-002", nombre: "Frijol 1kg", categoria: "Abarrotes", precioCompra: 22, precioVenta: 30, stock: 8, stockMinimo: 10 },
    { sku: "BE-001", nombre: "Refresco 600ml", categoria: "Bebidas", precioCompra: 12, precioVenta: 18, stock: 60, stockMinimo: 15 },
    { sku: "BE-002", nombre: "Agua 1L", categoria: "Bebidas", precioCompra: 8, precioVenta: 12, stock: 5, stockMinimo: 12 },
    { sku: "LI-001", nombre: "Jabón de trastes", categoria: "Limpieza", precioCompra: 15, precioVenta: 22, stock: 25, stockMinimo: 8, proveedorId: distribuidora.id },
  ];

  for (const { categoria, ...producto } of productos) {
    const existente = await prisma.producto.findUnique({ where: { sku: producto.sku } });
    if (existente) continue;
    // Producto.stock es el total cacheado: debe coincidir con la suma de StockBodega.
    await prisma.producto.create({
      data: {
        ...producto,
        categoriaId: categorias[categoria].id,
        unidadId: unidadPieza.id,
        stockBodegas: { create: [{ bodegaId: principal.id, cantidad: producto.stock }] },
      },
    });
  }

  const tiposTurno = ["Turno Mañana", "Turno Tarde"];
  for (const nombre of tiposTurno) {
    await prisma.tipoTurno.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  console.log("Seed completado");
  console.log("Usuarios de prueba: admin@inventario.local / admin123, cajero@inventario.local / cajero123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
