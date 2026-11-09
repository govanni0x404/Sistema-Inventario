const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Devoluciones: monto reembolsado y arqueo", () => {
  let cajero, producto, tipoTurno, turno;
  const auth = () => ({ Authorization: `Bearer ${cajero.token}` });

  async function vender(body) {
    const res = await request(app).post("/api/ventas").set(auth()).send(body);
    expect(res.status).toBe(201);
    return res.body;
  }

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ stock: 20, precioVenta: 20 });
    tipoTurno = await crearTipoTurno();
    const abrir = await request(app).post("/api/turnos").set(auth()).send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    turno = abrir.body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("reembolsa lo realmente cobrado: descuento del ítem y del ticket prorrateados", async () => {
    // bruto 4 × 20 = 80; -8 descuento de ítem = 72; -18 descuento de ticket = total 54.
    // Cobrado por unidad = (72 / 4) × (54 / 72) = 13.50
    const venta = await vender({
      pagos: [{ metodoPago: "efectivo", monto: 54 }],
      descuento: 18,
      items: [{ productoId: producto.id, cantidad: 4, descuento: 8 }],
    });

    const res = await request(app)
      .post(`/api/ventas/${venta.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(27);
    expect(res.body.metodoReembolso).toBe("efectivo");
    expect(res.body.turnoCajaId).toBe(turno.id);
  });

  test("devolver todo nunca reembolsa más que el total cobrado (redondeo)", async () => {
    // 3 × 20 = 60, descuento de ticket 10 → total 50. Por unidad 16.666… → redondeos.
    const venta = await vender({
      pagos: [{ metodoPago: "efectivo", monto: 50 }],
      descuento: 10,
      items: [{ productoId: producto.id, cantidad: 3 }],
    });
    const ventaItemId = venta.items[0].id;

    let reembolsado = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/ventas/${venta.id}/devolucion`)
        .set(auth())
        .send({ items: [{ ventaItemId, cantidad: 1 }] });
      expect(res.status).toBe(201);
      reembolsado += res.body.total;
    }
    expect(Math.round(reembolsado * 100) / 100).toBe(50);
  });

  test("una cortesía devuelve el stock pero reembolsa $0 y sin método", async () => {
    const venta = await vender({ esCortesia: true, motivoCortesia: "Prueba", items: [{ productoId: producto.id, cantidad: 1 }] });

    const res = await request(app)
      .post(`/api/ventas/${venta.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(0);
    expect(res.body.metodoReembolso).toBeNull();
  });

  test("con pago dividido hay que indicar el método de reembolso", async () => {
    const venta = await vender({
      pagos: [
        { metodoPago: "efectivo", monto: 10 },
        { metodoPago: "tarjeta", monto: 30 },
      ],
      items: [{ productoId: producto.id, cantidad: 2 }],
    });
    const ventaItemId = venta.items[0].id;

    const sinMetodo = await request(app)
      .post(`/api/ventas/${venta.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId, cantidad: 1 }] });
    expect(sinMetodo.status).toBe(400);

    const conMetodo = await request(app)
      .post(`/api/ventas/${venta.id}/devolucion`)
      .set(auth())
      .send({ metodoReembolso: "tarjeta", items: [{ ventaItemId, cantidad: 1 }] });
    expect(conMetodo.status).toBe(201);
    expect(conMetodo.body.metodoReembolso).toBe("tarjeta");
  });

  test("el arqueo resta el efectivo devuelto, pero no lo devuelto con tarjeta", async () => {
    const enEfectivo = await vender({ pagos: [{ metodoPago: "efectivo", monto: 40 }], items: [{ productoId: producto.id, cantidad: 2 }] });
    const conTarjeta = await vender({ pagos: [{ metodoPago: "tarjeta", monto: 20 }], items: [{ productoId: producto.id, cantidad: 1 }] });

    await request(app)
      .post(`/api/ventas/${enEfectivo.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId: enEfectivo.items[0].id, cantidad: 1 }] }); // -20 efectivo
    await request(app)
      .post(`/api/ventas/${conTarjeta.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId: conTarjeta.items[0].id, cantidad: 1 }] }); // tarjeta: no toca la caja

    // esperado = 100 fondo + 40 efectivo vendido − 20 efectivo devuelto = 120
    const cierre = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(auth()).send({ montoContado: 120 });
    expect(cierre.status).toBe(200);
    expect(cierre.body.montoEsperado).toBe(120);
    expect(cierre.body.diferencia).toBe(0);
    expect(cierre.body.resumenVentas.devolucionesPorMetodo).toEqual({ efectivo: 20, tarjeta: 20, transferencia: 0 });
  });

  test("no permite devolver efectivo si no hay turno abierto", async () => {
    const venta = await vender({ pagos: [{ metodoPago: "efectivo", monto: 20 }], items: [{ productoId: producto.id, cantidad: 1 }] });
    await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(auth()).send({ montoContado: 120 });

    const res = await request(app)
      .post(`/api/ventas/${venta.id}/devolucion`)
      .set(auth())
      .send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] });
    expect(res.status).toBe(409);
  });
});

describe("Turnos: aperturas simultáneas", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("dos aperturas al mismo tiempo dejan un solo turno abierto", async () => {
    await resetDb();
    const cajero = await crearUsuario({ rol: "cajero" });
    const tipoTurno = await crearTipoTurno();

    const intentos = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/turnos")
          .set("Authorization", `Bearer ${cajero.token}`)
          .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 })
      )
    );

    const estados = intentos.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.turnoCaja.count({ where: { estado: "abierto" } })).toBe(1);
  });
});
