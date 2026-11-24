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

  test("cada turno conserva el fondo ingresado al abrir su caja y su propio arqueo", async () => {
    const admin = await crearUsuario({ rol: "admin" });
    const adminAuth = { Authorization: `Bearer ${admin.token}` };
    const auth = { Authorization: `Bearer ${cajero.token}` };
    const principal = await prisma.caja.findFirstOrThrow({ where: { principal: true } });
    // El fondo previo de la caja no reemplaza el monto ingresado en la apertura.
    await request(app).put(`/api/cajas/${principal.id}`).set(adminAuth)
      .send({ nombre: principal.nombre, fondoFijo: 750 }).expect(200);
    await request(app).post("/api/cajas").set(auth).send({ nombre: "Caja 2" }).expect(403);
    const { body: secundaria } = await request(app).post("/api/cajas").set(adminAuth)
      .send({ nombre: "Caja 2" }).expect(201);

    const abrir = (cajaId, montoInicial) => request(app).post("/api/turnos").set(auth)
      .send({ cajaId, tipoTurnoId: tipoTurno.id, montoInicial });
    await abrir(secundaria.id).expect(400);
    await abrir(secundaria.id, -1).expect(400);
    const { body: turno1 } = await abrir(principal.id, 1000).expect(201);
    const { body: turno2 } = await abrir(secundaria.id, 3000).expect(201);
    await abrir(secundaria.id, 4000).expect(409);
    expect([turno1.montoInicial, turno2.montoInicial]).toEqual([1000, 3000]);
    const { body: actual } = await request(app).get(`/api/turnos/actual?cajaId=${secundaria.id}`).set(auth).expect(200);
    expect(actual.id).toBe(turno2.id);

    const producto = await crearProducto({ stock: 10, precioVenta: 50 });
    const venta = { pagos: [{ metodoPago: "efectivo", monto: 100 }], items: [{ productoId: producto.id, cantidad: 2 }] };
    await request(app).post("/api/ventas").set(auth).send(venta).expect(409);
    const { body: ticket } = await request(app).post("/api/ventas").set(auth).send({ ...venta, turnoCajaId: turno2.id }).expect(201);
    expect(ticket.turnoCajaId).toBe(turno2.id);
    await request(app).post("/api/movimientos-caja").set(auth)
      .send({ turnoCajaId: turno2.id, tipo: "retiro", monto: 20, motivo: "Cambio" }).expect(201);
    const { body: deCaja1 } = await request(app).get(`/api/movimientos-caja?turnoCajaId=${turno1.id}`).set(auth).expect(200);
    expect(deCaja1).toEqual([]);
    const { body: devolucion } = await request(app).post(`/api/ventas/${ticket.id}/devolucion`).set(auth)
      .send({ turnoCajaId: turno1.id, items: [{ ventaItemId: ticket.items[0].id, cantidad: 1 }] }).expect(201);
    expect(devolucion.turnoCajaId).toBe(turno1.id);

    await request(app).put(`/api/cajas/${secundaria.id}`).set(adminAuth)
      .send({ nombre: secundaria.nombre, activa: false }).expect(409);
    await request(app).put(`/api/cajas/${secundaria.id}`).set(adminAuth)
      .send({ nombre: secundaria.nombre, activa: true }).expect(200);
    const { body: cajas } = await request(app).get("/api/cajas").set(auth).expect(200);
    expect(cajas.find((caja) => caja.id === secundaria.id)).toMatchObject({
      turnoAbierto: { id: turno2.id, nombre: tipoTurno.nombre, montoInicial: 3000 },
    });
    for (const [turno, montoContado] of [[turno1, 950], [turno2, 3080]]) {
      const { body } = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(auth).send({ montoContado }).expect(200);
      expect(body.diferencia).toBe(0);
    }
    await request(app).post("/api/turnos").set(auth)
      .send({ cajaId: secundaria.id, tipoTurnoId: tipoTurno.id, fondoFijoEsperado: 3000 }).expect(409);
    const { body: siguiente } = await abrir(secundaria.id, 4000).expect(201);
    expect(siguiente.montoInicial).toBe(4000);
    await request(app).post("/api/ventas").set(auth).send({ ...venta, turnoCajaId: turno2.id }).expect(409);
    await request(app).post(`/api/turnos/${siguiente.id}/cerrar`).set(auth).send({ montoContado: 4000 }).expect(200);
    const { body: sinEfectivo } = await abrir(secundaria.id, 0).expect(201);
    expect(sinEfectivo.montoInicial).toBe(0);
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
  describe("permisos cruzados con Caja e Historial", () => {
    async function bloquear(seccion) {
      const rol = await prisma.rol.findUnique({ where: { nombre: "cajero" } });
      await prisma.rolPermiso.create({ data: { rolId: rol.id, seccion, permitido: false } });
    }

    test("con 'caja' pero sin 'turnos' puede consultar, abrir y cerrar el turno", async () => {
      await bloquear("turnos");
      const auth = { Authorization: `Bearer ${cajero.token}` };

      const actual = await request(app).get("/api/turnos/actual").set(auth);
      expect(actual.status).toBe(200);

      const abierto = await request(app).post("/api/turnos").set(auth).send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
      expect(abierto.status).toBe(201);

      const detalle = await request(app).get(`/api/turnos/${abierto.body.id}`).set(auth);
      expect(detalle.status).toBe(200);

      const cerrado = await request(app).post(`/api/turnos/${abierto.body.id}/cerrar`).set(auth).send({ montoContado: 100 });
      expect(cerrado.status).toBe(200);
    });

    test("con 'historial' pero sin 'turnos' puede listar turnos (filtro del Historial)", async () => {
      await bloquear("turnos");
      const res = await request(app).get("/api/turnos").set("Authorization", `Bearer ${cajero.token}`);
      expect(res.status).toBe(200);
    });

    test("sin 'turnos' ni 'historial' no puede listar turnos", async () => {
      await bloquear("turnos");
      await bloquear("historial");
      const res = await request(app).get("/api/turnos").set("Authorization", `Bearer ${cajero.token}`);
      expect(res.status).toBe(403);
    });
  });
});
