const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Bodegas", () => {
  let admin, cajero, principal, producto;

  beforeEach(async () => {
    await resetDb();
    principal = await crearBodegaPrincipal();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ stock: 10 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un cajero sin permiso de bodega no puede crear una bodega", async () => {
    const rolCajero = await prisma.rol.findUnique({ where: { nombre: "cajero" } });
    await prisma.rolPermiso.create({ data: { rolId: rolCajero.id, seccion: "bodega", permitido: false } });
    const res = await request(app)
      .post("/api/bodegas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ nombre: "Bodega Secundaria" });
    expect(res.status).toBe(403);
  });

  test("crea una bodega nueva y siembra stock en 0 para cada producto existente", async () => {
    const res = await request(app)
      .post("/api/bodegas")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Bodega Secundaria", direccion: "Calle Falsa 123" });

    expect(res.status).toBe(201);
    expect(res.body.principal).toBe(false);

    const stock = await request(app)
      .get(`/api/bodegas/${res.body.id}/stock`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(stock.body).toHaveLength(1);
    expect(stock.body[0].cantidad).toBe(0);
    expect(stock.body[0].productoId).toBe(producto.id);
  });

  test("rechaza crear una bodega con nombre repetido", async () => {
    const res = await request(app)
      .post("/api/bodegas")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: principal.nombre });
    expect(res.status).toBe(409);
  });

  test("la bodega principal no se puede desactivar, renombrar ni eliminar", async () => {
    const desactivar = await request(app)
      .put(`/api/bodegas/${principal.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ activo: false });
    expect(desactivar.status).toBe(400);

    const renombrar = await request(app)
      .put(`/api/bodegas/${principal.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Otro nombre" });
    expect(renombrar.status).toBe(400);

    const eliminar = await request(app)
      .delete(`/api/bodegas/${principal.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(eliminar.status).toBe(400);
  });

  test("no permite eliminar una bodega que todavía tiene stock asignado", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    await prisma.stockBodega.create({ data: { bodegaId: secundaria.id, productoId: producto.id, cantidad: 5 } });

    const res = await request(app)
      .delete(`/api/bodegas/${secundaria.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
  });

  test("elimina una bodega vacía sin problema", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Vacía" } });
    const res = await request(app)
      .delete(`/api/bodegas/${secundaria.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);
  });

  test("eliminar una bodega mientras recibe stock no pierde unidades", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    const auth = `Bearer ${admin.token}`;
    const [entrada, baja] = await Promise.all([
      request(app)
        .post(`/api/productos/${producto.id}/movimientos`)
        .set("Authorization", auth)
        .send({ tipo: "entrada", cantidad: 2, bodegaId: secundaria.id }),
      request(app).delete(`/api/bodegas/${secundaria.id}`).set("Authorization", auth),
    ]);

    expect([[201, 409], [404, 204]]).toContainEqual([entrada.status, baja.status]);
    const [productoFinal, stockBodegas] = await Promise.all([
      prisma.producto.findUnique({ where: { id: producto.id } }),
      prisma.stockBodega.aggregate({ where: { productoId: producto.id }, _sum: { cantidad: true } }),
    ]);
    expect(productoFinal.stock).toBe(entrada.status === 201 ? 12 : 10);
    expect(stockBodegas._sum.cantidad).toBe(productoFinal.stock);
  });

  test("transferencia mueve stock entre bodegas y deja 2 movimientos de auditoría", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    await prisma.stockBodega.create({ data: { bodegaId: secundaria.id, productoId: producto.id, cantidad: 0 } });

    const res = await request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ origenBodegaId: principal.id, destinoBodegaId: secundaria.id, productoId: producto.id, cantidad: 4 });

    expect(res.status).toBe(201);
    expect(res.body.salida.tipo).toBe("salida");
    expect(res.body.entrada.tipo).toBe("entrada");
    expect(res.body.salida.origen).toBe("transferencia");

    const stockOrigen = await prisma.stockBodega.findUnique({
      where: { bodegaId_productoId: { bodegaId: principal.id, productoId: producto.id } },
    });
    const stockDestino = await prisma.stockBodega.findUnique({
      where: { bodegaId_productoId: { bodegaId: secundaria.id, productoId: producto.id } },
    });
    expect(stockOrigen.cantidad).toBe(6);
    expect(stockDestino.cantidad).toBe(4);

    // El total del producto no cambia: solo se redistribuye entre bodegas.
    const productoActualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(productoActualizado.stock).toBe(10);

    const movimientos = await prisma.movimientoStock.count({ where: { productoId: producto.id, origen: "transferencia" } });
    expect(movimientos).toBe(2);
  });

  test("rechaza la transferencia si la bodega de origen no tiene stock suficiente", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });

    const res = await request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ origenBodegaId: principal.id, destinoBodegaId: secundaria.id, productoId: producto.id, cantidad: 999 });

    expect(res.status).toBe(409);
  });

  test("dos transferencias simultáneas no pueden usar las mismas unidades", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    const transferir = () => request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ origenBodegaId: principal.id, destinoBodegaId: secundaria.id, productoId: producto.id, cantidad: 6 });

    const respuestas = await Promise.all([transferir(), transferir()]);
    expect(respuestas.map((res) => res.status).sort()).toEqual([201, 409]);
    const stocks = await prisma.stockBodega.findMany({ where: { productoId: producto.id } });
    expect(stocks.find((stock) => stock.bodegaId === principal.id).cantidad).toBe(4);
    expect(stocks.find((stock) => stock.bodegaId === secundaria.id).cantidad).toBe(6);
    expect(await prisma.movimientoStock.count({ where: { productoId: producto.id } })).toBe(2);
  });

  test("Caja consulta el stock de la bodega principal en el catálogo y en los carritos en espera", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    const auth = `Bearer ${admin.token}`;
    const transferencia = await request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", auth)
      .send({ origenBodegaId: principal.id, destinoBodegaId: secundaria.id, productoId: producto.id, cantidad: 6 });
    expect(transferencia.status).toBe(201);

    const catalogo = await request(app).get("/api/productos").set("Authorization", auth);
    expect(catalogo.body).toEqual([expect.objectContaining({ id: producto.id, stock: 10, stockCaja: 4 })]);

    const detalle = await request(app).get(`/api/productos/${producto.id}`).set("Authorization", auth);
    expect(detalle.body).toMatchObject({ stock: 10, stockCaja: 4 });

    const enEspera = await request(app)
      .post("/api/ventas-en-espera")
      .set("Authorization", auth)
      .send({ items: [{ productoId: producto.id, cantidad: 3 }] });
    expect(enEspera.status).toBe(201);
    expect(enEspera.body.items[0].producto).toMatchObject({ stock: 10, stockCaja: 4, activo: true });
  });

  test("una bodega inactiva puede vaciarse mediante transferencia pero no recibir stock", async () => {
    const secundaria = await prisma.bodega.create({ data: { nombre: "Bodega Secundaria" } });
    const transferir = (origenBodegaId, destinoBodegaId) => request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ origenBodegaId, destinoBodegaId, productoId: producto.id, cantidad: 1 });

    expect((await transferir(principal.id, secundaria.id)).status).toBe(201);
    await prisma.bodega.update({ where: { id: secundaria.id }, data: { activo: false } });
    expect((await transferir(principal.id, secundaria.id)).status).toBe(409);
    expect((await transferir(secundaria.id, principal.id)).status).toBe(201);
    const final = await prisma.stockBodega.findUnique({ where: { bodegaId_productoId: { bodegaId: principal.id, productoId: producto.id } } });
    expect(final.cantidad).toBe(10);
  });

  test("rechaza la transferencia si origen y destino son la misma bodega", async () => {
    const res = await request(app)
      .post("/api/bodegas/transferencias")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ origenBodegaId: principal.id, destinoBodegaId: principal.id, productoId: producto.id, cantidad: 1 });

    expect(res.status).toBe(400);
  });

  test("una venta descuenta el stock de la bodega principal", async () => {
    const tipoTurno = await crearTipoTurno();
    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });

    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ pagos: [{ metodoPago: "efectivo", monto: 30 }], items: [{ productoId: producto.id, cantidad: 3 }] });

    expect(venta.status).toBe(201);

    const stockPrincipal = await prisma.stockBodega.findUnique({
      where: { bodegaId_productoId: { bodegaId: principal.id, productoId: producto.id } },
    });
    expect(stockPrincipal.cantidad).toBe(7);
  });
});
