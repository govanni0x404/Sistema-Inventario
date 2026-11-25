const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearBodegaPrincipal } = require("./helpers");

describe("Ficha de producto", () => {
  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
  });
  afterAll(() => prisma.$disconnect());

  test("genera EAN-13 distintos y conserva los parámetros y la imagen al editar", async () => {
    const { token } = await crearUsuario({ rol: "admin" });
    const auth = { Authorization: `Bearer ${token}` };
    const unidad = await prisma.unidad.create({ data: { nombre: "Unidad" } });
    const categoria = await prisma.categoria.create({ data: { nombre: "Bebidas" } });
    const generar = () => request(app).post("/api/productos/codigo-barras").set(auth).expect(200);
    const { body: primero } = await generar();
    const { body: segundo } = await generar();
    expect(primero.codigoBarras).toMatch(/^20\d{11}$/);
    expect(segundo.codigoBarras).not.toBe(primero.codigoBarras);
    expect([...primero.codigoBarras].reduce((total, digito, i) => total + Number(digito) * (i % 2 ? 3 : 1), 0) % 10).toBe(0);

    const datos = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=";
    const ficha = {
      codigoBarras: primero.codigoBarras, nombre: "Producto de prueba", unidadId: unidad.id,
      categoriaId: categoria.id, subfamilia: "Agua", tipoImpuesto: "exento", precioVenta: 100,
      inventariable: false, ventaPublico: false, mostrarPrecio: false, ventaVolumen: true, esPack: true,
    };
    await request(app).post("/api/productos").set(auth).send({ ...ficha, imagenArchivo: "data:image/png;base64,SG9sYQ==" }).expect(400);
    const { body: producto } = await request(app).post("/api/productos").set(auth)
      .send({ ...ficha, imagenArchivo: `data:image/png;base64,${datos}` }).expect(201);
    expect(producto).toMatchObject(ficha);
    expect(producto).not.toHaveProperty("foto");
    expect(producto).not.toHaveProperty("sku");
    await request(app).get(producto.imagenUrl).expect(401);
    const respuesta = await request(app).get(producto.imagenUrl).set(auth).expect("Content-Type", /image\/png/).expect(200);
    expect(respuesta.body).toEqual(Buffer.from(datos, "base64"));

    const { body: editado } = await request(app).put(`/api/productos/${producto.id}`).set(auth)
      .send({ precioVenta: 120 }).expect(200);
    expect(editado).toMatchObject({ ...ficha, precioVenta: 120, imagenUrl: producto.imagenUrl });
    const { body: enLinea } = await request(app).put(`/api/productos/${producto.id}`).set(auth)
      .send({ imagenUrl: "https://example.com/foto.png" }).expect(200);
    expect(enLinea.imagenUrl).toBe("https://example.com/foto.png");
    await request(app).get(producto.imagenUrl).set(auth).expect(404);
  });

  test("asigna un código de barras al crear un producto sin ingresar uno", async () => {
    const { token } = await crearUsuario({ rol: "admin" });
    const unidad = await prisma.unidad.create({ data: { nombre: "Unidad" } });
    const { body } = await request(app).post("/api/productos").set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Producto sin código", unidadId: unidad.id, precioVenta: 100 }).expect(201);
    expect(body.codigoBarras).toMatch(/^20\d{11}$/);
    expect(body).not.toHaveProperty("sku");
  });
});

describe("Productos: eliminar", () => {
  let admin, producto;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
    producto = await crearProducto({ stock: 5 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("sin ventas: se borra físicamente (204)", async () => {
    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
    expect(await prisma.producto.findUnique({ where: { id: producto.id } })).toBeNull();
  });

  test("con ventas: se desactiva y responde _desactivado", async () => {
    await prisma.venta.create({
      data: {
        subtotal: 10,
        total: 10,
        items: { create: [{ productoId: producto.id, cantidad: 1, precioUnitario: 10, subtotal: 10 }] },
      },
    });

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
    const actual = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actual.activo).toBe(false);
  });

  test("en una venta en espera: se desactiva en vez de fallar con 500", async () => {
    await prisma.ventaEnEspera.create({
      data: { items: { create: [{ productoId: producto.id, cantidad: 1 }] } },
    });

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body._desactivado).toBe(true);
  });
});

describe("Productos: importar", () => {
  let admin;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("actualizar por código de barras conserva los campos vacíos y el stock", async () => {
    const producto = await crearProducto({ precioCompra: 12, precioVenta: 20, stockMinimo: 7, codigoBarras: "7801234" });

    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ codigoBarras: producto.codigoBarras, nombre: "Nuevo nombre", precioVenta: 25, precioCompra: "", stock: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.resumen.actualizados).toBe(1);
    const actual = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actual.nombre).toBe("Nuevo nombre");
    expect(Number(actual.precioVenta)).toBe(25);
    expect(Number(actual.precioCompra)).toBe(12);
    expect(actual.stockMinimo).toBe(7);
    expect(actual.codigoBarras).toBe("7801234");
    expect(actual.stock).toBe(producto.stock);
  });

  test("un cambio de precio por importación queda en el historial de precios", async () => {
    const producto = await crearProducto({ precioCompra: 12, precioVenta: 20, codigoBarras: "7809876" });

    await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ codigoBarras: producto.codigoBarras, nombre: producto.nombre, precioVenta: 30 }] });

    const historial = await prisma.historialPrecio.findMany({ where: { productoId: producto.id } });
    expect(historial).toHaveLength(1);
    expect(Number(historial[0].precioVentaAnterior)).toBe(20);
    expect(Number(historial[0].precioVentaNuevo)).toBe(30);
  });

  test("crear un producto nuevo usa 0 en los campos vacíos y siembra el stock en bodega", async () => {
    await prisma.unidad.create({ data: { nombre: "Pieza" } });
    const res = await request(app)
      .post("/api/productos/importar")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ productos: [{ codigoBarras: "7803333", nombre: "Nuevo", precioVenta: 10, stock: 4 }] });

    expect(res.body.resumen.creados).toBe(1);
    const creado = await prisma.producto.findUnique({ where: { codigoBarras: "7803333" }, include: { stockBodegas: true } });
    expect(Number(creado.precioCompra)).toBe(0);
    expect(creado.stockMinimo).toBe(0);
    expect(creado.stock).toBe(4);
    expect(creado.stockBodegas.reduce((s, b) => s + b.cantidad, 0)).toBe(4);
  });
});
