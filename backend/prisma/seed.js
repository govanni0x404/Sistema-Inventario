const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

if (process.env.NODE_ENV === "production") {
  throw new Error("El seed de demostración solo está disponible fuera de producción.");
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { bloquearCatalogoBodegas, inicializarStockProducto, crearProductoCatalogo } = require("../src/lib/stockBodega");

const prisma = new PrismaClient();

async function crearDatosDemostracion(tx) {
  await bloquearCatalogoBodegas(tx);
  const admin = await tx.rol.upsert({
    where: { nombre: "admin" },
    update: {},
    create: { nombre: "admin", protegido: true },
  });
  const cajero = await tx.rol.upsert({
    where: { nombre: "cajero" },
    update: {},
    create: { nombre: "cajero" },
  });

  const usuarios = [
    { email: "admin@inventario.local", nombre: "Administrador", password: "admin123", rolId: admin.id },
    { email: "cajero@inventario.local", nombre: "Cajero", password: "cajero123", rolId: cajero.id },
  ];

  for (const u of usuarios) {
    await tx.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash(u.password, 10) },
    });
  }

  const distribuidora = await tx.proveedor.upsert({
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
  const unidadPieza = await tx.unidad.upsert({ where: { nombre: "Pieza" }, update: {}, create: { nombre: "Pieza" } });
  const categorias = {};
  for (const nombre of ["Abarrotes", "Bebidas", "Limpieza"]) {
    categorias[nombre] = await tx.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // La migración de bodegas crea "Bodega Principal"; si la BD se creó de otra forma, se asegura aquí.
  const principal = await tx.bodega.findFirst({ where: { principal: true } });
  if (!principal) {
    await tx.bodega.create({ data: { nombre: "Bodega Principal", principal: true } });
  }

  const productos = [
    { sku: "AB-001", nombre: "Arroz 1kg", categoria: "Abarrotes", precioCompra: 18, precioVenta: 25, stock: 40, stockMinimo: 10 },
    { sku: "AB-002", nombre: "Frijol 1kg", categoria: "Abarrotes", precioCompra: 22, precioVenta: 30, stock: 8, stockMinimo: 10 },
    { sku: "BE-001", nombre: "Refresco 600ml", categoria: "Bebidas", precioCompra: 12, precioVenta: 18, stock: 60, stockMinimo: 15 },
    { sku: "BE-002", nombre: "Agua 1L", categoria: "Bebidas", precioCompra: 8, precioVenta: 12, stock: 5, stockMinimo: 12 },
    { sku: "LI-001", nombre: "Jabón de trastes", categoria: "Limpieza", precioCompra: 15, precioVenta: 22, stock: 25, stockMinimo: 8, proveedorId: distribuidora.id },
  ];

  for (const { categoria, stock, ...producto } of productos) {
    const existente = await tx.producto.findUnique({ where: { sku: producto.sku } });
    if (existente) continue;
    const creado = await crearProductoCatalogo(tx, {
      ...producto, categoriaId: categorias[categoria].id, unidadId: unidadPieza.id,
    });
    await inicializarStockProducto(tx, creado.id, stock);
  }

  const tiposTurno = ["Turno Mañana", "Turno Tarde"];
  for (const nombre of tiposTurno) {
    await tx.tipoTurno.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
}

async function main() {
  await prisma.$transaction(crearDatosDemostracion);
  console.log("Seed completado");
  console.log("Usuarios de prueba: admin@inventario.local / admin123, cajero@inventario.local / cajero123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
