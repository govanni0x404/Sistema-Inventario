const { randomUUID } = require("node:crypto");
const request = require("supertest");
const app = require("../src/app");
const { prisma, stockDeProducto, resetDb, crearUsuario, crearProducto, crearBodegaPrincipal } = require("./helpers");

describe("Compras y planificación por bodega", () => {
  let admin, producto, proveedor, bodega, principal, auth;

  beforeEach(async () => {
    await resetDb();
    admin = await crearUsuario({ rol: "admin" });
    auth = `Bearer ${admin.token}`;
    principal = await crearBodegaPrincipal();
    proveedor = await prisma.proveedor.create({ data: { nombre: "Proveedor de prueba" } });
    producto = await crearProducto({
      nombre: "Café de prueba", codigoBarras: "CAFE-001", proveedorId: proveedor.id,
      stock: 7, stockMinimo: 9, precioCompra: 100.25,
    });
    const creada = await request(app).post("/api/bodegas").set("Authorization", auth).send({ nombre: "Recepción" });
    expect(creada.status).toBe(201);
    bodega = creada.body;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function datosOrden(cantidad = 8) {
    return {
      id: randomUUID(), proveedorId: proveedor.id, bodegaId: bodega.id, entregaEstimada: "2026-12-02",
      items: [{ productoId: producto.id, cantidad, costoUnitario: 120.5 }],
    };
  }

  async function crearOrden(datos = datosOrden()) {
    const res = await request(app).post("/api/compras").set("Authorization", auth).send(datos);
    expect(res.status).toBe(201);
    return res.body;
  }

  function cambiarEstado(orden, accion, motivo) {
    return request(app).post(`/api/compras/${orden.id}/estado`).set("Authorization", auth)
      .send({ accion, motivo, revision: orden.actualizadoEn });
  }

  function operar(orden, datos) {
    return request(app).post(`/api/compras/${orden.id}/operaciones`).set("Authorization", auth).send(datos);
  }

  async function stock(productoId = producto.id, bodegaId = bodega.id) {
    return prisma.stockBodega.findUnique({ where: { bodegaId_productoId: { bodegaId, productoId } } });
  }

  function informe(params = {}) {
    return request(app).get("/api/planificacion").query({ bodegaId: bodega.id, ...params }).set("Authorization", auth);
  }

  test("edita un borrador, conserva las referencias y lo emite para iniciar recepciones", async () => {
    const datos = datosOrden();
    const orden = await crearOrden(datos);
    expect(await crearOrden(datos)).toEqual(orden);
    expect(orden.items[0]).toMatchObject({ sku: "CAFE-001", cantidad: 8, recibida: 0, costoUnitario: "120.5" });
    expect(orden.entregaEstimada).toBe("2026-12-02T00:00:00.000Z");
    const editar = (revision) => request(app).put(`/api/compras/${orden.id}`).set("Authorization", auth)
      .send({ ...datos, revision, items: [{ ...datos.items[0], cantidad: 9 }] });
    expect((await editar("2025-01-01T12:00:00.000Z")).status).toBe(409);
    const actualizada = await editar(orden.actualizadoEn);
    expect(actualizada.status).toBe(200);
    expect(actualizada.body.items[0].cantidad).toBe(9);
    expect((await cambiarEstado(orden, "emitir")).status).toBe(409);
    expect((await cambiarEstado(actualizada.body, "emitir")).body.estado).toBe("emitida");
    expect((await editar(actualizada.body.actualizadoEn)).status).toBe(409);
    expect((await stock()).cantidad).toBe(0);
    const lista = await request(app).get("/api/compras").query({ estado: "emitida", folio: orden.folio })
      .set("Authorization", auth);
    expect(lista.body).toMatchObject({ total: 1, ordenes: [{ id: orden.id }] });
  });

  test("registra recepciones parciales y completas, reintentos y devoluciones vinculadas al kárdex", async () => {
    const orden = await crearOrden();
    const [{ id: itemId }] = orden.items;
    const parcial = { id: randomUUID(), documento: "Guía 85", items: [{ itemId, cantidad: 3 }] };
    expect((await operar(orden, parcial)).status).toBe(409);
    await cambiarEstado(orden, "emitir");

    const primera = await operar(orden, parcial);
    expect(primera.status).toBe(201);
    expect(primera.body).toMatchObject({ estado: "parcial", items: [{ recibida: 3 }] });
    expect((await operar(orden, parcial)).body.operaciones).toHaveLength(1);
    expect((await operar(orden, { ...parcial, documento: "Otra guía" })).status).toBe(409);
    expect((await stock()).cantidad).toBe(3);
    expect((await operar(orden, { ...parcial, id: randomUUID(), items: [{ itemId, cantidad: 6 }] })).status).toBe(409);
    const segunda = await operar(orden, { id: randomUUID(), documento: "Guía 86", items: [{ itemId, cantidad: 5 }] });
    expect(segunda.body).toMatchObject({ estado: "recibida", items: [{ recibida: 8 }] });

    const devolucion = { id: randomUUID(), recepcionId: parcial.id, documento: "Nota de crédito 90", items: [{ itemId, cantidad: 2 }] };
    const devuelta = await operar(orden, devolucion);
    expect(devuelta.status).toBe(201);
    expect(devuelta.body).toMatchObject({ estado: "recibida", items: [{ recibida: 8 }] });
    expect((await operar(orden, { ...devolucion, id: randomUUID() })).status).toBe(409);
    expect((await operar(orden, devolucion)).status).toBe(201);
    expect((await stock()).cantidad).toBe(6);
    expect((await stock(producto.id, principal.id)).cantidad).toBe(7);
    expect(await stockDeProducto(producto.id)).toBe(13);
    const movimientos = await request(app).get(`/api/productos/${producto.id}/movimientos`).set("Authorization", auth);
    expect(movimientos.body).toHaveLength(3);
    expect(movimientos.body[0]).toMatchObject({
      origen: "devolucion_compra", bodegaId: bodega.id, stockResultante: 6, ordenCompraId: orden.id, operacionCompraId: devolucion.id,
    });
  });

  test("dos recepciones simultáneas no pueden recibir las mismas unidades", async () => {
    const orden = await crearOrden();
    await cambiarEstado(orden, "emitir");
    const itemId = orden.items[0].id;
    const resultados = await Promise.all(["A", "B"].map((documento) =>
      operar(orden, { id: randomUUID(), documento, items: [{ itemId, cantidad: 8 }] })));
    expect(resultados.map((res) => res.status).sort()).toEqual([201, 409]);
    expect((await stock()).cantidad).toBe(8);
    expect(await prisma.operacionCompra.count({ where: { ordenId: orden.id } })).toBe(1);
  });

  test("PostgreSQL impide usar una recepción de otra orden como origen de una devolución", async () => {
    const orden = await crearOrden();
    const otra = await crearOrden();
    await cambiarEstado(orden, "emitir");
    const recepcionId = randomUUID();
    await operar(orden, { id: recepcionId, documento: "Guía 1", items: [{ itemId: orden.items[0].id, cantidad: 1 }] });
    await expect(prisma.operacionCompra.create({ data: {
      id: randomUUID(), ordenId: otra.id, recepcionId, documento: "NC", usuarioNombre: "Inventario",
    } })).rejects.toMatchObject({ code: "P2003" });
  });

  test("revierte toda la devolución si falta stock de una línea en la bodega", async () => {
    const otro = await crearProducto({ stock: 0 });
    const datos = datosOrden(3);
    datos.items.push({ productoId: otro.id, cantidad: 2, costoUnitario: 1 });
    const orden = await crearOrden(datos);
    await cambiarEstado(orden, "emitir");
    const recepcion = { id: randomUUID(), documento: "Guía", items: orden.items.map((it) => ({ itemId: it.id, cantidad: it.cantidad })) };
    expect((await operar(orden, recepcion)).status).toBe(201);
    const salida = await request(app).post(`/api/productos/${otro.id}/movimientos`).set("Authorization", auth)
      .send({ tipo: "salida", cantidad: 2, bodegaId: bodega.id });
    expect(salida.status).toBe(201);
    const ordenLineas = [producto.id, otro.id].map((productoId) => {
      const item = orden.items.find((it) => it.productoId === productoId);
      return { itemId: item.id, cantidad: item.cantidad };
    });
    const id = randomUUID();
    expect((await operar(orden, { id, documento: "NC", recepcionId: recepcion.id, items: ordenLineas })).status).toBe(409);
    expect((await stock()).cantidad).toBe(3);
    expect(await prisma.operacionCompra.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.movimientoStock.count({ where: { origen: "devolucion_compra" } })).toBe(0);
  });

  test("descuenta órdenes pendientes, valoriza con el costo vigente y permite restablecer el mínimo", async () => {
    const endpoint = `/api/planificacion/${bodega.id}/productos/${producto.id}/minimo`;
    const minimo = (stockMinimo) => request(app).put(endpoint).set("Authorization", auth).send({ stockMinimo });
    expect((await minimo(12)).status).toBe(204);
    const orden = await crearOrden();
    expect((await informe()).body.filas[0]).toMatchObject({ minimo: 12, cantidad: 0, pendiente: "0", sugerido: "12" });
    await cambiarEstado(orden, "emitir");
    expect((await informe()).body.filas[0]).toMatchObject({ pendiente: "8", sugerido: "4" });
    const parcial = await operar(orden, { id: randomUUID(), documento: "Guía", items: [{ itemId: orden.items[0].id, cantidad: 3 }] });
    const filtrado = await informe({ q: "CAFE-001", estado: "reponer", proveedorId: proveedor.id });
    expect(filtrado.status).toBe(200);
    expect(filtrado.body.resumen).toMatchObject({ total: 1, unidades: "3", valor: "300.75", reponer: 1 });
    expect(filtrado.body.filas[0]).toMatchObject({ cantidad: 3, pendiente: "5", sugerido: "4" });
    expect((await cambiarEstado(parcial.body, "anular", "Llegó una parte")).status).toBe(409);
    expect((await cambiarEstado(parcial.body, "cerrar", "Proveedor sin existencias")).body.estado).toBe("cerrada");
    expect((await informe({ exportar: "true" })).body[0]).toMatchObject({ pendiente: "0", sugerido: "9" });
    expect((await minimo(null)).status).toBe(204);
    expect((await informe()).body.filas[0]).toMatchObject({ minimoConfigurado: null, minimo: 0, sugerido: "0" });
    expect((await informe({ bodegaId: principal.id })).body.filas[0]).toMatchObject({ minimo: 9, sugerido: "2" });
  });

  test("los permisos se habilitan por separado y los cambios quedan en auditoría", async () => {
    const cajero = await crearUsuario();
    const autorizado = (ruta) => request(app).get(`/api/${ruta}`).set("Authorization", `Bearer ${cajero.token}`);
    expect((await autorizado("compras")).status).toBe(403);
    expect((await autorizado("planificacion")).status).toBe(403);
    const permisos = await request(app).put("/api/permisos").set("Authorization", auth)
      .send({ cambios: [{ rol: "cajero", seccion: "compras", permitido: true }] });
    expect(permisos.status).toBe(200);
    expect((await autorizado("compras")).status).toBe(200);
    expect((await autorizado("planificacion")).status).toBe(403);
    const registro = await prisma.registroAuditoria.findFirst({ where: { detalle: "cajero / compras" } });
    expect(registro).toMatchObject({ valorAnterior: "false", valorNuevo: "true", usuarioId: admin.usuario.id });
  });

  test("el kárdex registra existencias iniciales y filtra entradas, salidas y documentos por bodega", async () => {
    const inicial = await request(app).post("/api/productos").set("Authorization", auth).send({
      nombre: "Producto nuevo", precioVenta: 35, stock: 4, unidadId: producto.unidadId,
    });
    expect(inicial.status).toBe(201);
    const kardex = (query) => request(app).get("/api/bodegas/kardex").query(query).set("Authorization", auth);
    const altas = await kardex({ origen: "saldo_inicial", productoId: inicial.body.id });
    expect(altas.status).toBe(200);
    expect(altas.body).toMatchObject({ total: 1, entradas: 4, salidas: 0, filas: [{ bodegaId: principal.id, usuarioId: admin.usuario.id }] });
    const orden = await crearOrden();
    await cambiarEstado(orden, "emitir");
    const itemId = orden.items[0].id;
    await operar(orden, { id: randomUUID(), documento: "Guía 120", items: [{ itemId, cantidad: 3 }] });
    const recepciones = await kardex({ bodegaId: bodega.id, tipo: "entrada", q: "CAFE-001" });
    expect(recepciones.body).toMatchObject({ total: 1, entradas: 3, salidas: 0 });
    const todas = await kardex({ exportar: "true", bodegaId: bodega.id });
    expect(todas.body).toMatchObject([{ operacionCompra: { ordenId: orden.id, documento: "Guía 120" } }]);
    expect((await kardex({ tipo: "salida" })).body).toMatchObject({ total: 0 });
    expect((await kardex({ desde: "2025-11-01" })).status).toBe(400);
  });
});
