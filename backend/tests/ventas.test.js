const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Ventas", () => {
  let cajero, admin, producto, tipoTurno;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    admin = await crearUsuario({ rol: "admin" });
    producto = await crearProducto({ stock: 10, precioVenta: 20 });
    tipoTurno = await crearTipoTurno();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rechaza vender sin turno de caja abierto", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 20 }], items: [{ productoId: producto.id, cantidad: 1 }] });

    expect(res.status).toBe(409);
  });

  test("crea la venta, descuenta stock y aplica descuentos por item y por ticket", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [{ metodoPago: "efectivo", monto: 32 }],
        descuento: 5,
        items: [{ productoId: producto.id, cantidad: 2, descuento: 3 }],
      });

    expect(res.status).toBe(201);
    // bruto 20*2=40, -3 descuento de item = subtotal 37; -5 descuento de ticket = total 32
    expect(res.body.subtotal).toBe(37);
    expect(res.body.descuento).toBe(5);
    expect(res.body.total).toBe(32);

    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.stock).toBe(8);
  });

  test("permite pagar con hasta 2 formas de pago cuya suma sea el total", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [
          { metodoPago: "efectivo", monto: 15 },
          { metodoPago: "tarjeta", monto: 25 },
        ],
        items: [{ productoId: producto.id, cantidad: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(40);
    expect(res.body.pagos).toHaveLength(2);
    expect(res.body.pagos.map((p) => p.monto).sort()).toEqual([15, 25]);
  });

  test("rechaza la venta si las 2 formas de pago son la misma", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [
          { metodoPago: "tarjeta", monto: 20 },
          { metodoPago: "tarjeta", monto: 20 },
        ],
        items: [{ productoId: producto.id, cantidad: 2 }],
      });

    expect(res.status).toBe(400);
  });

  test("rechaza la venta si la suma de los pagos no coincide con el total", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [{ metodoPago: "efectivo", monto: 10 }],
        items: [{ productoId: producto.id, cantidad: 2 }],
      });

    expect(res.status).toBe(400);
  });

  test("rechaza la venta si el descuento del ticket excede el subtotal", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 1 }], descuento: 999, items: [{ productoId: producto.id, cantidad: 1 }] });

    expect(res.status).toBe(400);
  });

  test("rechaza la venta si el stock es insuficiente", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 1 }], items: [{ productoId: producto.id, cantidad: 999 }] });

    expect(res.status).toBe(409);
  });

  test("una devolución restaura el stock y no permite exceder lo disponible", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 60 }], items: [{ productoId: producto.id, cantidad: 3 }] });

    const ventaItemId = venta.body.items[0].id;

    const devolucion = await request(app)
      .post(`/api/ventas/${venta.body.id}/devolucion`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ items: [{ ventaItemId, cantidad: 1 }] });

    expect(devolucion.status).toBe(201);

    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.stock).toBe(8); // 10 - 3 vendidas + 1 devuelta

    // Solo quedan 2 disponibles para devolver (3 vendidas - 1 ya devuelta); pedir 5 debe fallar.
    const exceso = await request(app)
      .post(`/api/ventas/${venta.body.id}/devolucion`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ items: [{ ventaItemId, cantidad: 5 }] });

    expect(exceso.status).toBe(409);
  });

  test("una venta de cortesía descuenta stock, no requiere pago y queda sin pagos", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        esCortesia: true,
        motivoCortesia: "Regalo por cumpleaños del cliente",
        items: [{ productoId: producto.id, cantidad: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.esCortesia).toBe(true);
    expect(res.body.pagos).toHaveLength(0);
    expect(res.body.total).toBe(40);

    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.stock).toBe(8);
  });

  test("rechaza una venta de cortesía sin motivo", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const res = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ esCortesia: true, items: [{ productoId: producto.id, cantidad: 1 }] });

    expect(res.status).toBe(400);
  });
});
