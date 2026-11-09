const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearTipoTurno, crearRolesBase } = require("./helpers");

describe("Permisos", () => {
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

  test("un usuario no admin no puede acceder a /api/permisos", async () => {
    const res = await request(app).get("/api/permisos").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(403);
  });

  test("sin configuración previa, todas las secciones están permitidas por defecto", async () => {
    const res = await request(app).get("/api/permisos").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(["cajero"]);
    expect(Object.values(res.body.permisos.cajero).every((v) => v === true)).toBe(true);
  });

  test("actualizar permisos bloquea al rol afectado, pero el admin nunca se ve afectado", async () => {
    const tipoTurno = await crearTipoTurno();

    const put = await request(app)
      .put("/api/permisos")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        cambios: [
          { rol: "cajero", seccion: "turnos", permitido: false },
          { rol: "cajero", seccion: "caja", permitido: false },
        ],
      });

    expect(put.status).toBe(200);
    expect(put.body.permisos.cajero.turnos).toBe(false);
    expect(put.body.permisos.cajero.caja).toBe(false);

    const bloqueado = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    expect(bloqueado.status).toBe(403);

    const permitidoParaAdmin = await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    expect(permitidoParaAdmin.status).toBe(201);
  });

  test("un usuario desactivado no puede iniciar sesión aunque la contraseña sea correcta", async () => {
    const { usuario } = await crearUsuario({ rol: "cajero", activo: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: usuario.email, password: "test1234" });

    expect(res.status).toBe(403);
  });
  test("un token deja de servir apenas se desactiva al usuario", async () => {
    const antes = await request(app).get("/api/productos").set("Authorization", `Bearer ${cajero.token}`);
    expect(antes.status).toBe(200);

    await prisma.usuario.update({ where: { id: cajero.usuario.id }, data: { activo: false } });

    const despues = await request(app).get("/api/productos").set("Authorization", `Bearer ${cajero.token}`);
    expect(despues.status).toBe(401);
  });

  test("si a un admin le quitan el rol, su token viejo ya no da acceso de admin", async () => {
    const rolCajero = await prisma.rol.findUnique({ where: { nombre: "cajero" } });
    await prisma.usuario.update({ where: { id: admin.usuario.id }, data: { rolId: rolCajero.id } });

    const res = await request(app).get("/api/permisos").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(403);
  });
});
