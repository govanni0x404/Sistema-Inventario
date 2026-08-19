const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const usuarios = [
    { email: "admin@inventario.local", nombre: "Administrador", password: "admin123", rol: "admin" },
    { email: "cajero@inventario.local", nombre: "Cajero", password: "cajero123", rol: "cajero" },
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

  const productos = [
    { sku: "AB-001", nombre: "Arroz 1kg", categoria: "Abarrotes", precioCompra: 18, precioVenta: 25, stock: 40, stockMinimo: 10, unidad: "pieza" },
    { sku: "AB-002", nombre: "Frijol 1kg", categoria: "Abarrotes", precioCompra: 22, precioVenta: 30, stock: 8, stockMinimo: 10, unidad: "pieza" },
    { sku: "BE-001", nombre: "Refresco 600ml", categoria: "Bebidas", precioCompra: 12, precioVenta: 18, stock: 60, stockMinimo: 15, unidad: "pieza" },
    { sku: "BE-002", nombre: "Agua 1L", categoria: "Bebidas", precioCompra: 8, precioVenta: 12, stock: 5, stockMinimo: 12, unidad: "pieza" },
    { sku: "LI-001", nombre: "Jabón de trastes", categoria: "Limpieza", precioCompra: 15, precioVenta: 22, stock: 25, stockMinimo: 8, unidad: "pieza", proveedorId: distribuidora.id },
  ];

  for (const producto of productos) {
    await prisma.producto.upsert({
      where: { sku: producto.sku },
      update: {},
      create: producto,
    });
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
