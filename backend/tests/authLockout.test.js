const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearRolesBase } = require("./helpers");

// Cada test que ejercita el bloqueo consume varios intentos contra el mismo endpoint de
// login, que también tiene un rate limit por IP (10/15min, ver auth.routes.js). Jest le da
// a cada ARCHIVO de test su propio registro de módulos (así que cada archivo re-instancia
// `app` y arranca con el limiter de IP en cero) pero NO a cada test dentro del mismo
// archivo — por eso este escenario vive solo, en un único test, para no acumular intentos
// entre tests y disparar el limiter de IP en vez del de cuenta que se quiere probar aquí.
describe("Bloqueo de cuenta tras intentos fallidos", () => {
  let cajero1;

  beforeEach(async () => {
    await resetDb();
    await crearRolesBase();
    cajero1 = await crearUsuario({ rol: "cajero" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("tras 5 contraseñas incorrectas, la cuenta se bloquea incluso con la contraseña correcta", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: cajero1.usuario.email, password: "mala_password" });
      expect(res.status).toBe(401);
    }

    const bloqueado = await request(app)
      .post("/api/auth/login")
      .send({ email: cajero1.usuario.email, password: "test1234" });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error).toMatch(/bloqueada temporalmente/);
  });
});
