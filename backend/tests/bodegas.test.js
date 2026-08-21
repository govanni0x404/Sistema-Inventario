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
