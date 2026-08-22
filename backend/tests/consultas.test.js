const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Consultas — márgenes por producto", () => {
  let cajero, producto, tipoTurno;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ stock: 10, precioCompra: 5, precioVenta: 20 });
    tipoTurno = await crearTipoTurno();

    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("calcula ingreso, costo y margen a partir del precio de compra actual", async () => {
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 40 }], items: [{ productoId: producto.id, cantidad: 2 }] });

    const res = await request(app).get("/api/consultas/productos-margen").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);

    const fila = res.body.productos.find((p) => p.productoId === producto.id);
    expect(fila).toBeTruthy();
    expect(fila.cantidad).toBe(2);
    expect(fila.ingreso).toBe(40);
    expect(fila.costo).toBe(10);
    expect(fila.margen).toBe(30);
    expect(fila.margenPct).toBe(75);
  });

  test("no cuenta ventas de cortesía en el margen", async () => {
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ esCortesia: true, motivoCortesia: "prueba", items: [{ productoId: producto.id, cantidad: 1 }] });

    const res = await request(app).get("/api/consultas/productos-margen").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);
    expect(res.body.productos.find((p) => p.productoId === producto.id)).toBeUndefined();
  });
});
