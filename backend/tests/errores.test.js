const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearBodegaPrincipal } = require("./helpers");

describe("Errores claros en vez de 500", () => {
  let admin;
  const auth = () => ({ Authorization: `Bearer ${admin.token}` });

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test.each([
    ["/api/ventas?fecha=hoy"],
    ["/api/ventas?desde=2026-13-01"],
    ["/api/ventas?hasta=2026-02-30"],
    ["/api/turnos?desde=ayer"],
    ["/api/dashboard?desde=2026-02-30&hasta=2026-03-04"],
  ])("fecha inválida en %s responde 400", async (url) => {
    const res = await request(app).get(url).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Fecha inválida/);
  });

  test("una fecha válida sigue funcionando", async () => {
    const res = await request(app).get("/api/ventas?desde=2026-01-01&hasta=2026-01-31").set(auth());
    expect(res.status).toBe(200);
  });

  test.each([
    ["desde=2026-01-01"],
    ["desde=2026-03-02&hasta=2026-02-27"],
    ["desde=2024-01-01&hasta=2025-01-02"],
    ["dias=7dias"],
  ])("el dashboard rechaza el rango inválido %s", async (query) => {
    const res = await request(app).get(`/api/dashboard?${query}`).set(auth());
    expect(res.status).toBe(400);
  });

  test("el dashboard devuelve una fila por día de calendario", async () => {
    const res = await request(app).get("/api/dashboard?desde=2026-04-03&hasta=2026-04-06").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.rango.dias).toBe(4);
    expect(res.body.ventasPorDia.map((fila) => fila.fecha)).toEqual([
      "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06",
    ]);
  });

  test("el dashboard cruza ventas recientes, vendedores y pagos del período", async () => {
    const fecha = new Date("2026-04-04T15:00:00Z");
    const usuarioId = admin.usuario.id;
    const pagada = await prisma.venta.create({
      data: { fecha, total: 5000, usuarioId, pagos: { create: [
        { metodoPago: "efectivo", monto: 2000 }, { metodoPago: "tarjeta", monto: 3000 },
      ] } },
    });
    const cortesia = await prisma.venta.create({
      data: { fecha: new Date(fecha.getTime() + 1000), total: 0, usuarioId, esCortesia: true },
    });
    await prisma.venta.create({ data: { fecha: new Date("2026-04-07T15:00:00Z"), total: 9000, usuarioId } });

    const res = await request(app).get("/api/dashboard?desde=2026-04-03&hasta=2026-04-06").set(auth()).expect(200);
    expect(res.body.ventasPorUsuario).toEqual([{ usuarioId, nombre: admin.usuario.nombre, cantidad: 1, total: 5000 }]);
    expect(res.body.ventasPorMetodo).toEqual([{ metodoPago: "tarjeta", total: 3000 }, { metodoPago: "efectivo", total: 2000 }]);
    expect(res.body.ventasRecientes).toEqual([
      expect.objectContaining({ id: cortesia.id, esCortesia: true, pagos: [] }),
      expect.objectContaining({ id: pagada.id, total: 5000, pagos: expect.arrayContaining([{ metodoPago: "tarjeta", monto: 3000 }, { metodoPago: "efectivo", monto: 2000 }]) }),
    ]);
  });

  test("el dashboard protege las métricas cuando el rol no tiene permiso", async () => {
    const cajero = await crearUsuario();
    await prisma.rolPermiso.create({ data: { rolId: cajero.usuario.rolId, seccion: "dashboard", permitido: false } });
    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${cajero.token}`).expect(403);
  });

  test("una venta en espera con un producto que no existe responde 400, no 500", async () => {
    const res = await request(app)
      .post("/api/ventas-en-espera")
      .set(auth())
      .send({ items: [{ productoId: "00000000-0000-0000-0000-00000000dead", cantidad: 1 }] });
    expect(res.status).toBe(400);
  });
  test("listar ventas respeta el límite y devuelve las más recientes", async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.venta.create({ data: { subtotal: 1, total: 1, fecha: new Date(2026, 0, 1 + i) } });
    }
    const res = await request(app).get("/api/ventas?limite=2").set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(new Date(res.body[0].fecha).getDate()).toBe(3);
  });
});
