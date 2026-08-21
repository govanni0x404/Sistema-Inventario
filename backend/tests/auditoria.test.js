const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearRolesBase } = require("./helpers");

describe("Auditoría", () => {
  let admin, cajero;

  beforeEach(async () => {
    await resetDb();
    await crearRolesBase();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un cajero no puede leer el registro de auditoría", async () => {
    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(403);
  });

  test("un login exitoso queda registrado", async () => {
    await request(app).post("/api/auth/login").send({ email: cajero.usuario.email, password: "test1234" });

    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const registro = res.body.find((r) => r.accion === "login_exitoso" && r.usuarioId === cajero.usuario.id);
    expect(registro).toBeTruthy();
  });

  test("un login fallido (contraseña incorrecta) queda registrado", async () => {
    await request(app).post("/api/auth/login").send({ email: cajero.usuario.email, password: "mala_password" });

    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${admin.token}`);
    const registro = res.body.find((r) => r.accion === "login_fallido" && r.usuarioAfectadoId === cajero.usuario.id);
    expect(registro).toBeTruthy();
    expect(registro.detalle).toBe("contraseña incorrecta");
  });

  test("cambiar el rol de un usuario queda registrado con el valor anterior y el nuevo", async () => {
    await prisma.rol.create({ data: { nombre: "supervisor" } });

    await request(app)
      .put(`/api/usuarios/${cajero.usuario.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ rol: "supervisor" });

    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${admin.token}`);
    const registro = res.body.find((r) => r.accion === "usuario_rol_cambiado" && r.usuarioAfectadoId === cajero.usuario.id);
    expect(registro).toBeTruthy();
    expect(registro.valorAnterior).toBe("cajero");
    expect(registro.valorNuevo).toBe("supervisor");
    expect(registro.usuarioId).toBe(admin.usuario.id);
  });

  test("resetear la contraseña de un usuario queda registrado", async () => {
    await request(app)
      .put(`/api/usuarios/${cajero.usuario.id}/password`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ password: "nueva12345" });

    const res = await request(app).get("/api/auditoria").set("Authorization", `Bearer ${admin.token}`);
    const registro = res.body.find((r) => r.accion === "password_reseteada" && r.usuarioAfectadoId === cajero.usuario.id);
    expect(registro).toBeTruthy();
  });
});
