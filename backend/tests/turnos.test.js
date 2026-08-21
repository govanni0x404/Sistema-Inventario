const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Turnos de caja", () => {
  let cajero, tipoTurno;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    tipoTurno = await crearTipoTurno();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("abre un turno correctamente", async () => {
    const res = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 500 });

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("abierto");
    expect(res.body.montoInicial).toBe(500);
  });

  test("no permite abrir un segundo turno mientras haya uno abierto", async () => {
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 500 });

    const res = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 300 });

    expect(res.status).toBe(409);
  });

  test("el cierre calcula el esperado (fondo inicial + efectivo vendido) y la diferencia", async () => {
    const abrir = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const producto = await crearProducto({ stock: 10, precioVenta: 50 });
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 100 }], items: [{ productoId: producto.id, cantidad: 2 }] }); // $100 en efectivo

    // esperado = 100 (fondo inicial) + 100 (efectivo vendido) = 200
    const cierre = await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 190 });

    expect(cierre.status).toBe(200);
    expect(cierre.body.montoEsperado).toBe(200);
    expect(cierre.body.diferencia).toBe(-10);
    expect(cierre.body.estado).toBe("cerrado");
  });

  test("una venta con pago dividido solo cuenta la parte en efectivo para el arqueo", async () => {
    const abrir = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const producto = await crearProducto({ stock: 10, precioVenta: 50 });
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [
          { metodoPago: "efectivo", monto: 30 },
          { metodoPago: "tarjeta", monto: 70 },
        ],
        items: [{ productoId: producto.id, cantidad: 2 }],
      });

    // esperado = 100 (fondo) + 30 (solo la parte en efectivo del pago dividido) = 130
    const cierre = await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 130 });

    expect(cierre.status).toBe(200);
    expect(cierre.body.montoEsperado).toBe(130);
    expect(cierre.body.diferencia).toBe(0);
  });

  test("una venta de cortesía no cuenta en el arqueo del turno", async () => {
    const abrir = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const producto = await crearProducto({ stock: 10, precioVenta: 50 });
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 50 }], items: [{ productoId: producto.id, cantidad: 1 }] });
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ esCortesia: true, motivoCortesia: "Prueba", items: [{ productoId: producto.id, cantidad: 1 }] });

    // esperado = 100 (fondo) + 50 (solo la venta real) — la cortesía no suma nada.
    const cierre = await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 150 });

    expect(cierre.status).toBe(200);
    expect(cierre.body.montoEsperado).toBe(150);
    expect(cierre.body.diferencia).toBe(0);
  });

  test("no permite cerrar un turno que ya está cerrado", async () => {
    const abrir = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 100 });

    const res = await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 100 });

    expect(res.status).toBe(409);
  });

  test("un retiro resta y un ingreso suma al monto esperado del arqueo", async () => {
    const abrir = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const retiro = await request(app)
      .post("/api/movimientos-caja")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipo: "retiro", monto: 30, motivo: "Pago a proveedor" });
    expect(retiro.status).toBe(201);

    const ingreso = await request(app)
      .post("/api/movimientos-caja")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipo: "ingreso", monto: 20, motivo: "Sencillo para cambio" });
    expect(ingreso.status).toBe(201);

    // esperado = 100 (fondo) - 30 (retiro) + 20 (ingreso) = 90
    const cierre = await request(app)
      .post(`/api/turnos/${abrir.body.id}/cerrar`)
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ montoContado: 90 });

    expect(cierre.status).toBe(200);
    expect(cierre.body.montoEsperado).toBe(90);
    expect(cierre.body.diferencia).toBe(0);
    expect(cierre.body.movimientosCaja.ingresos).toBe(20);
    expect(cierre.body.movimientosCaja.retiros).toBe(30);
  });

  test("rechaza un movimiento de caja si no hay turno abierto", async () => {
    const res = await request(app)
      .post("/api/movimientos-caja")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipo: "retiro", monto: 10, motivo: "Prueba" });
    expect(res.status).toBe(409);
  });
});
