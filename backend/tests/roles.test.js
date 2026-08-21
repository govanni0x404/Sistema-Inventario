const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearRolesBase } = require("./helpers");

describe("Roles", () => {
  let admin, cajero;

  beforeEach(async () => {
    await resetDb();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
    await crearRolesBase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un cajero no puede crear roles", async () => {
    const res = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ nombre: "supervisor" });
    expect(res.status).toBe(403);
  });

  test("un admin puede crear un rol nuevo", async () => {
    const res = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "supervisor" });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("supervisor");
    expect(res.body.protegido).toBe(false);
  });

  test("rechaza crear un rol duplicado o llamado admin", async () => {
    const dup = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "cajero" });
    expect(dup.status).toBe(409);

    const comoAdmin = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "admin" });
    expect(comoAdmin.status).toBe(409);
  });

  test("el rol admin no se puede renombrar ni eliminar", async () => {
    const rolAdmin = await prisma.rol.findUnique({ where: { nombre: "admin" } });

    const rename = await request(app)
      .put(`/api/roles/${rolAdmin.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "superadmin" });
    expect(rename.status).toBe(400);

    const eliminar = await request(app).delete(`/api/roles/${rolAdmin.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(eliminar.status).toBe(400);
  });

  test("renombrar un rol propaga el cambio a los usuarios que lo tienen asignado", async () => {
    const rolCajero = await prisma.rol.findUnique({ where: { nombre: "cajero" } });

    const res = await request(app)
      .put(`/api/roles/${rolCajero.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "vendedor" });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("vendedor");

    const usuarioActualizado = await prisma.usuario.findUnique({ where: { id: cajero.usuario.id }, include: { rol: true } });
    expect(usuarioActualizado.rol.nombre).toBe("vendedor");
  });

  test("eliminar un rol en uso lo desactiva en vez de borrarlo", async () => {
    const rolCajero = await prisma.rol.findUnique({ where: { nombre: "cajero" } });

    const res = await request(app).delete(`/api/roles/${rolCajero.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
    expect(res.body.activo).toBe(false);

    const sigueExistiendo = await prisma.rol.findUnique({ where: { id: rolCajero.id } });
    expect(sigueExistiendo).not.toBeNull();
  });

  test("eliminar un rol sin uso lo borra de verdad", async () => {
    await request(app).post("/api/roles").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "temporal" });
    const rolTemporal = await prisma.rol.findUnique({ where: { nombre: "temporal" } });

    const res = await request(app).delete(`/api/roles/${rolTemporal.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    const sigueExistiendo = await prisma.rol.findUnique({ where: { id: rolTemporal.id } });
    expect(sigueExistiendo).toBeNull();
  });
});
