const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearBodegaPrincipal } = require("./helpers");

describe("Productos: eliminar", () => {
  let admin, producto;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
    producto = await crearProducto({ stock: 5 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("sin ventas: se borra físicamente (204)", async () => {
    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
    expect(await prisma.producto.findUnique({ where: { id: producto.id } })).toBeNull();
  });

  test("con ventas: se desactiva y responde _desactivado", async () => {
    await prisma.venta.create({
      data: {
        subtotal: 10,
        total: 10,
        items: { create: [{ productoId: producto.id, cantidad: 1, precioUnitario: 10, subtotal: 10 }] },
      },
    });

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
    const actual = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actual.activo).toBe(false);
  });

  test("en una venta en espera: se desactiva en vez de fallar con 500", async () => {
    await prisma.ventaEnEspera.create({
      data: { items: { create: [{ productoId: producto.id, cantidad: 1 }] } },
    });

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
  });
});

describe("Productos: importar", () => {
  let admin;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("actualizar por SKU no pisa con 0 los campos que vienen vacíos o no vienen", async () => {
    const producto = await crearProducto({ precioCompra: 12, precioVenta: 20, stockMinimo: 7, codigoBarras: "7801234" });

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ sku: producto.sku, nombre: "Nuevo nombre", precioVenta: 25, precioCompra: "", codigoBarras: "" }] });

    expect(res.status).toBe(200);
    expect(res.body.resumen.actualizados).toBe(1);
    const actual = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actual.nombre).toBe("Nuevo nombre");
    expect(Number(actual.precioVenta)).toBe(25);
    expect(Number(actual.precioCompra)).toBe(12);
    expect(actual.stockMinimo).toBe(7);
    expect(actual.codigoBarras).toBe("7801234");
  });

  test("un cambio de precio por importación queda en el historial de precios", async () => {
    const producto = await crearProducto({ precioCompra: 12, precioVenta: 20 });

    await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ sku: producto.sku, nombre: producto.nombre, precioVenta: 30 }] });

    const historial = await prisma.historialPrecio.findMany({ where: { productoId: producto.id } });
    expect(historial).toHaveLength(1);
    expect(Number(historial[0].precioVentaAnterior)).toBe(20);
    expect(Number(historial[0].precioVentaNuevo)).toBe(30);
  });

  test("crear un producto nuevo usa 0 en los campos vacíos y siembra el stock en bodega", async () => {
    await prisma.unidad.create({ data: { nombre: "Pieza" } });
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ sku: "NUEVO-1", nombre: "Nuevo", precioVenta: 10, stock: 4 }] });

    expect(res.body.resumen.creados).toBe(1);
    const creado = await prisma.producto.findUnique({ where: { sku: "NUEVO-1" }, include: { stockBodegas: true } });
    expect(Number(creado.precioCompra)).toBe(0);
    expect(creado.stockMinimo).toBe(0);
    expect(creado.stock).toBe(4);
    expect(creado.stockBodegas.reduce((s, b) => s + b.cantidad, 0)).toBe(4);
  });
});
