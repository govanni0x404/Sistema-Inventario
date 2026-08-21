const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto } = require("./helpers");

describe("Listas de precio", () => {
  let admin, cajero, producto;

  beforeEach(async () => {
    await resetDb();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ precioVenta: 50 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un cajero sin permiso de precios no puede crear una lista", async () => {
    const rolCajero = await prisma.rol.findUnique({ where: { nombre: "cajero" } });
    await prisma.rolPermiso.create({ data: { rolId: rolCajero.id, seccion: "precios", permitido: false } });
    const res = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ nombre: "Mayorista" });
    expect(res.status).toBe(403);
  });

  test("crear con copiarPrecios=true copia los precios actuales de los productos", async () => {
    const res = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Mayorista", copiarPrecios: true });
    expect(res.status).toBe(201);

    const precios = await request(app)
      .get(`/api/listas-precio/${res.body.id}/precios`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(precios.body).toHaveLength(1);
    expect(precios.body[0].precio).toBe(50);
    expect(precios.body[0].productoId).toBe(producto.id);
  });

  test("crear sin copiarPrecios arranca vacía", async () => {
    const res = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Promoción" });
    expect(res.status).toBe(201);

    const precios = await request(app)
      .get(`/api/listas-precio/${res.body.id}/precios`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(precios.body).toHaveLength(0);
  });

  test("guardar y quitar un precio override en una lista", async () => {
    const lista = await request(app)
      .post("/api/listas-precio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Promoción" });

    const guardar = await request(app)
      .put(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ precio: 35 });
    expect(guardar.status).toBe(200);
    expect(guardar.body.precio).toBe(35);

    const quitar = await request(app)
      .delete(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(quitar.status).toBe(204);

    const precios = await request(app)
      .get(`/api/listas-precio/${lista.body.id}/precios`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(precios.body).toHaveLength(0);
  });

  test("rechaza crear una lista con nombre duplicado", async () => {
    await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Mayorista" });
    const dup = await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Mayorista" });
    expect(dup.status).toBe(409);
  });

  test("eliminar una lista sin precios ni historial la borra de verdad", async () => {
    const lista = await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Vacía" });
    const res = await request(app).delete(`/api/listas-precio/${lista.body.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);
  });

  test("eliminar una lista con precios la desactiva en vez de borrarla", async () => {
    const lista = await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Mayorista" });
    await request(app)
      .put(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ precio: 35 });

    const res = await request(app).delete(`/api/listas-precio/${lista.body.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
    expect(res.body.activo).toBe(false);

    const sigueExistiendo = await prisma.listaPrecio.findUnique({ where: { id: lista.body.id } });
    expect(sigueExistiendo).not.toBeNull();
  });

  test("eliminar una lista que tuvo precios y ya no tiene ninguno igual se desactiva (no pierde el historial)", async () => {
    const lista = await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Promoción" });
    await request(app)
      .put(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ precio: 35 });
    await request(app)
      .delete(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app).delete(`/api/listas-precio/${lista.body.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
  });

  test("cambiar un precio en una lista queda en el historial con el valor anterior y el nuevo", async () => {
    const lista = await request(app).post("/api/listas-precio").set("Authorization", `Bearer ${admin.token}`).send({ nombre: "Mayorista" });

    await request(app)
      .put(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ precio: 35 });
    await request(app)
      .put(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ precio: 40 });
    await request(app)
      .delete(`/api/listas-precio/${lista.body.id}/precios/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    const historial = await request(app)
      .get(`/api/listas-precio/${lista.body.id}/precios/${producto.id}/historial`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(historial.status).toBe(200);
    expect(historial.body).toHaveLength(3);
    // más reciente primero: quitar (35->40 se quita, nuevo null), luego 35->40, luego null->35
    expect(historial.body[0]).toMatchObject({ precioAnterior: 40, precioNuevo: null });
    expect(historial.body[1]).toMatchObject({ precioAnterior: 35, precioNuevo: 40 });
    expect(historial.body[2]).toMatchObject({ precioAnterior: null, precioNuevo: 35 });
  });
});
