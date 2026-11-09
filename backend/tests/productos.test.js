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
