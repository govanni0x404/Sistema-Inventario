const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearRolesBase } = require("./helpers");

// En archivo aparte a propósito: ver la nota en authLockout.test.js sobre por qué el
// rate limit de IP obliga a separar escenarios de bloqueo en archivos de test distintos.
describe("Bloqueo de cuenta — aislamiento entre cuentas", () => {
  let cajero1, cajero2;

  beforeEach(async () => {
    await resetDb();
    await crearRolesBase();
    cajero1 = await crearUsuario({ rol: "cajero" });
    cajero2 = await crearUsuario({ rol: "cajero" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("el bloqueo de una cuenta no afecta a otra cuenta", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ email: cajero1.usuario.email, password: "mala_password" });
    }

    const otraCuenta = await request(app)
      .post("/api/auth/login")
      .send({ email: cajero2.usuario.email, password: "test1234" });
    expect(otraCuenta.status).toBe(200);
  });
});
