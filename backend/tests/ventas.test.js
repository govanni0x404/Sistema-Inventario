const { randomUUID } = require("node:crypto");
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

  test("respeta venta al público y conserva la política de stock al devolver", async () => {
    const auth = { Authorization: `Bearer ${cajero.token}` };
    await request(app).post("/api/turnos").set(auth).send({ tipoTurnoId: tipoTurno.id, montoInicial: 0 }).expect(201);
    const servicio = await crearProducto({ stock: 0, precioVenta: 30, inventariable: false });
    const payload = { pagos: [{ metodoPago: "tarjeta", monto: 30 }], items: [{ productoId: servicio.id, cantidad: 1 }] };
    await prisma.producto.update({ where: { id: servicio.id }, data: { ventaPublico: false } });
    await request(app).post("/api/ventas").set(auth).send(payload).expect(409);
    await prisma.producto.update({ where: { id: servicio.id }, data: { ventaPublico: true } });
    const { body: venta } = await request(app).post("/api/ventas").set(auth).send(payload).expect(201);
    await prisma.producto.update({ where: { id: servicio.id }, data: { inventariable: true } });
    await request(app).post(`/api/ventas/${venta.id}/devolucion`).set(auth)
      .send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] }).expect(201);
    expect(await prisma.movimientoStock.count({ where: { productoId: servicio.id } })).toBe(0);
    expect((await prisma.producto.findUnique({ where: { id: servicio.id } })).stock).toBe(0);
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

  test("un pago con diferencia de un centavo no modifica el stock ni la caja", async () => {
    const headers = { Authorization: `Bearer ${cajero.token}` };
    await request(app).post("/api/turnos").set(headers).send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    const res = await request(app).post("/api/ventas").set(headers).send({
      pagos: [{ metodoPago: "efectivo", monto: 19.99 }],
      items: [{ productoId: producto.id, cantidad: 1 }],
    });

    expect(res.status).toBe(400);
    expect(await prisma.venta.count()).toBe(0);
    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.stock).toBe(10);
  });

  test("los reintentos simultáneos y posteriores al cierre recuperan la venta original", async () => {
    const headers = { Authorization: `Bearer ${cajero.token}` };
    const turno = await request(app).post("/api/turnos").set(headers).send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    const body = {
      claveIdempotencia: randomUUID(),
      pagos: [{ metodoPago: "efectivo", monto: 20 }],
      items: [{ productoId: producto.id, cantidad: 1 }],
    };
    const cobrar = (datos = body) => request(app).post("/api/ventas").set(headers).send(datos);
    const [primera, segunda] = await Promise.all([cobrar(), cobrar()]);
    expect([primera.status, segunda.status]).toEqual([201, 201]);
    expect(primera.body.id).toBe(segunda.body.id);
    expect(primera.body.claveIdempotencia).toBeUndefined();
    expect(primera.body.huellaSolicitud).toBeUndefined();

    const cierre = await request(app).post(`/api/turnos/${turno.body.id}/cerrar`).set(headers).send({ montoContado: 120 });
    expect(cierre.status).toBe(200);
    expect(cierre.body.diferencia).toBe(0);
    const repetida = await cobrar();
    expect(repetida.status).toBe(201);
    expect(repetida.body.id).toBe(primera.body.id);

    const distinta = await cobrar({ ...body, pagos: [{ metodoPago: "tarjeta", monto: 20 }] });
    expect(distinta.status).toBe(409);
    expect(await prisma.venta.count()).toBe(1);
    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.stock).toBe(9);
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
  describe("con lista de precios", () => {
    async function abrirTurno() {
      await request(app)
        .post("/api/turnos")
        .set("Authorization", `Bearer ${cajero.token}`)
        .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    }

    test("cobra el precio de la lista cuando el producto tiene override", async () => {
      await abrirTurno();
      const lista = await prisma.listaPrecio.create({ data: { nombre: "Mayorista" } });
      await prisma.precioLista.create({ data: { listaPrecioId: lista.id, productoId: producto.id, precio: 15 } });

      const res = await request(app)
        .post("/api/ventas")
        .set("Authorization", `Bearer ${cajero.token}`)
        .send({
          listaPrecioId: lista.id,
          pagos: [
            { metodoPago: "efectivo", monto: 10 },
            { metodoPago: "tarjeta", monto: 20 },
          ],
          items: [{ productoId: producto.id, cantidad: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.total).toBe(30);
      expect(res.body.items[0].precioUnitario).toBe(15);
    });

    test("usa el precio base para productos sin override en la lista", async () => {
      await abrirTurno();
      const lista = await prisma.listaPrecio.create({ data: { nombre: "Promo" } });

      const res = await request(app)
        .post("/api/ventas")
        .set("Authorization", `Bearer ${cajero.token}`)
        .send({
          listaPrecioId: lista.id,
          pagos: [{ metodoPago: "efectivo", monto: 20 }],
          items: [{ productoId: producto.id, cantidad: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.total).toBe(20);
    });

    test("rechaza una lista inactiva o inexistente", async () => {
      await abrirTurno();
      const lista = await prisma.listaPrecio.create({ data: { nombre: "Vieja", activo: false } });

      const res = await request(app)
        .post("/api/ventas")
        .set("Authorization", `Bearer ${cajero.token}`)
        .send({
          listaPrecioId: lista.id,
          pagos: [{ metodoPago: "efectivo", monto: 20 }],
          items: [{ productoId: producto.id, cantidad: 1 }],
        });

      expect(res.status).toBe(404);
    });
  });
});
