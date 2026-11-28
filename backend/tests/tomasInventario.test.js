const { randomUUID } = require("node:crypto");
const request = require("supertest");
const app = require("../src/app");
const { prisma, stockDeProducto, resetDb, crearUsuario, crearProducto, crearBodegaPrincipal } = require("./helpers");

describe("Toma y ajuste de inventario", () => {
  let usuario, bodega, producto, auth, ruta;

  beforeEach(async () => {
    await resetDb();
    usuario = await crearUsuario({ rol: "admin" });
    bodega = await crearBodegaPrincipal();
    producto = await crearProducto({ stock: 10 });
    auth = `Bearer ${usuario.token}`;
    ruta = `/api/bodegas/${bodega.id}/tomas-inventario`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const registrar = (ruta, auth, data) => request(app).post(ruta).set("Authorization", auth).send(data);
  const linea = (producto, stockEsperado, stockContado) => ({ productoId: producto.id, stockEsperado, stockContado });

  test("guarda la toma, el conteo sin diferencia y las entradas y salidas asociadas a la bodega", async () => {
    const sinDiferencia = await crearProducto({ stock: 4 });
    const alta = await crearProducto({ stock: 2 });
    const secundaria = await prisma.bodega.create({ data: { nombre: "Secundaria" } });
    await request(app).post("/api/bodegas/transferencias").set("Authorization", auth).send({
      origenBodegaId: bodega.id, destinoBodegaId: secundaria.id, productoId: producto.id, cantidad: 3,
    }).expect(201);
    const id = randomUUID();
    const respuesta = await registrar(ruta, auth, {
      id, tipo: "inventario", motivo: "Conteo de cierre",
      items: [linea(producto, 7, 0), linea(sinDiferencia, 4, 4), linea(alta, 2, 5)],
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ id, lineas: 3, ajustes: 2, usuarioNombre: usuario.usuario.nombre });
    expect(respuesta.body.items).toEqual([
      expect.objectContaining({ productoId: producto.id, stockEsperado: 7, stockContado: 0, diferencia: -7 }),
      expect.objectContaining({ productoId: sinDiferencia.id, diferencia: 0 }),
      expect.objectContaining({ productoId: alta.id, diferencia: 3 }),
    ]);

    const stock = await prisma.stockBodega.findMany({ where: { productoId: producto.id } });
    expect(stock.find(({ bodegaId }) => bodegaId === bodega.id).cantidad).toBe(0);
    expect(stock.find(({ bodegaId }) => bodegaId === secundaria.id).cantidad).toBe(3);
    expect(await stockDeProducto(producto.id)).toBe(3);
    const movimientos = await prisma.movimientoStock.findMany({ where: { tomaInventarioId: id } });
    expect(movimientos).toHaveLength(2);
    expect(movimientos).toEqual(expect.arrayContaining([
      expect.objectContaining({ productoId: producto.id, tipo: "salida", origen: "inventario", cantidad: 7, stockResultante: 3, bodegaId: bodega.id }),
      expect.objectContaining({ productoId: alta.id, tipo: "entrada", origen: "inventario", cantidad: 3, stockResultante: 5 }),
    ]));
    const historial = await request(app).get(ruta).set("Authorization", auth).expect(200);
    expect(historial.body).toEqual([expect.objectContaining({ id, lineas: 3, ajustes: 2 })]);
    expect(historial.body[0]).not.toHaveProperty("items");
    const detalle = await request(app).get(`${ruta}/${id}`).set("Authorization", auth).expect(200);
    expect(detalle.body.items).toEqual(respuesta.body.items);
    await request(app).get(`/api/bodegas/${secundaria.id}/tomas-inventario/${id}`).set("Authorization", auth).expect(404);
  });

  test("no aplica ninguna línea si cambió el stock de otro producto durante el conteo", async () => {
    const otro = await crearProducto({ stock: 5 });
    await request(app).post(`/api/productos/${otro.id}/movimientos`).set("Authorization", auth)
      .send({ tipo: "salida", cantidad: 1, bodegaId: bodega.id }).expect(201);
    const respuesta = await registrar(ruta, auth, {
      id: randomUUID(), tipo: "inventario", motivo: "Inventario", items: [linea(producto, 10, 2), linea(otro, 5, 5)],
    });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toContain(otro.nombre);
    expect(await stockDeProducto(producto.id)).toBe(10);
    expect(await stockDeProducto(otro.id)).toBe(4);
    expect(await prisma.tomaInventario.count()).toBe(0);
    expect(await prisma.movimientoStock.count()).toBe(1);
  });

  test("reintentar el mismo ajuste guarda un solo movimiento y un solo cambio de stock", async () => {
    const data = {
      id: randomUUID(), tipo: "ajuste", motivo: "Corrección", items: [linea(producto, 10, 8)],
    };
    const resultados = await Promise.all([registrar(ruta, auth, data), registrar(ruta, auth, data)]);
    expect(resultados.map(({ status }) => status)).toEqual([201, 201]);
    expect(resultados[0].body).toEqual(resultados[1].body);
    const otroAjuste = await registrar(ruta, auth, { ...data, motivo: "Otro movimiento" });
    expect(otroAjuste.status).toBe(409);
    expect(await prisma.tomaInventario.count()).toBe(1);
    expect(await prisma.movimientoStock.count({ where: { origen: "ajuste" } })).toBe(1);
    expect(await stockDeProducto(producto.id)).toBe(8);
  });

  test("valida cantidades, ajustes sin diferencia y permiso de bodega", async () => {
    const payload = { id: randomUUID(), tipo: "ajuste", motivo: "Corrección", items: [linea(producto, 10, 5)] };
    const cajero = await crearUsuario({ rol: "cajero" });
    await prisma.rolPermiso.create({ data: { rolId: cajero.usuario.rolId, seccion: "bodega", permitido: false } });
    expect((await registrar(ruta, `Bearer ${cajero.token}`, payload)).status).toBe(403);
    expect((await registrar(ruta, auth, { ...payload, items: [linea(producto, 10, -5)] })).status).toBe(400);
    expect((await registrar(ruta, auth, { ...payload, items: [linea(producto, 10, 10)] })).status).toBe(400);
    expect(await prisma.tomaInventario.count()).toBe(0);
  });
});
