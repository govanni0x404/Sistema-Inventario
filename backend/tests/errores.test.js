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
  ])("fecha inválida en %s responde 400", async (url) => {
    const res = await request(app).get(url).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Fecha inválida/);
  });

  test("una fecha válida sigue funcionando", async () => {
    const res = await request(app).get("/api/ventas?desde=2026-01-01&hasta=2026-01-31").set(auth());
    expect(res.status).toBe(200);
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
