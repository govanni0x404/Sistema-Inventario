const { randomUUID } = require("node:crypto");
const request = require("supertest");
const app = require("../src/app");
const { hoy } = require("../src/lib/cotizaciones");
const { prisma, stockDeProducto, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

describe("Cotizaciones y mermas", () => {
  let auth, producto, cliente, principal;

  beforeEach(async () => {
    await resetDb();
    const usuario = await crearUsuario({ rol: "admin" });
    auth = { Authorization: `Bearer ${usuario.token}` };
    principal = await crearBodegaPrincipal();
    producto = await crearProducto({ stock: 10, precioVenta: 100, precioCompra: 2.25 });
    cliente = await prisma.cliente.create({ data: { nombre: "Comercio de prueba" } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function datosCotizacion(extra = {}) {
    return {
      id: randomUUID(), clienteId: cliente.id, vigenteHasta: hoy(), descuento: 10,
      items: [{ productoId: producto.id, cantidad: 2, descuento: 5 }], ...extra,
    };
  }

  function cotizar(payload = datosCotizacion()) {
    return request(app).post("/api/cotizaciones").set(auth).send(payload);
  }

  async function abrirCaja() {
    const tipoTurno = await crearTipoTurno();
    await request(app).post("/api/turnos").set(auth).send({ tipoTurnoId: tipoTurno.id, montoInicial: 0 }).expect(201);
  }

  function cobrar(datos, cotizacion, extra = {}) {
    return request(app).post("/api/ventas").set(auth).send({
      cotizacionId: cotizacion.id, clienteId: datos.clienteId, descuento: datos.descuento, items: datos.items,
      pagos: [{ metodoPago: "efectivo", monto: cotizacion.total }], ...extra,
    });
  }

  test("cotiza sin turno ni movimientos y convierte una sola vez con los precios que se ofrecieron", async () => {
    const lista = await prisma.listaPrecio.create({ data: { nombre: "Preferentes" } });
    await prisma.precioLista.create({ data: { listaPrecioId: lista.id, productoId: producto.id, precio: 80 } });
    const datos = datosCotizacion({ listaPrecioId: lista.id });
    const { body: cotizacion } = await cotizar(datos).expect(201);
    expect(cotizacion).toMatchObject({ estado: "vigente", total: 145, items: [{ precio: 8000 }] });
    expect((await cotizar(datos).expect(201)).body.id).toBe(cotizacion.id);
    await cotizar({ ...datos, descuento: 11 }).expect(409);
    expect(await prisma.movimientoStock.count()).toBe(0);
    expect(await stockDeProducto(producto.id)).toBe(10);
    await abrirCaja();
    await prisma.precioLista.update({
      where: { listaPrecioId_productoId: { listaPrecioId: lista.id, productoId: producto.id } }, data: { precio: 300 },
    });
    await cobrar(datos, cotizacion, { items: [{ productoId: producto.id, cantidad: 1, descuento: 5 }] }).expect(409);
    const clave = randomUUID();
    const simultaneas = await Promise.all([
      cobrar(datos, cotizacion, { claveIdempotencia: clave }),
      cobrar(datos, cotizacion, { claveIdempotencia: randomUUID() }),
    ]);
    expect(simultaneas.map((res) => res.status).sort()).toEqual([201, 409]);
    const venta = simultaneas.find((res) => res.status === 201).body;
    expect(venta).toMatchObject({ cotizacionId: cotizacion.id, total: 145, items: [{ precioUnitario: 80 }] });
    const { body: detalle } = await request(app).get(`/api/cotizaciones/${cotizacion.id}`).set(auth).expect(200);
    expect(detalle).toMatchObject({ estado: "vendida", venta: { id: venta.id } });
    expect(await prisma.movimientoStock.count()).toBe(1);
    await request(app).post(`/api/cotizaciones/${cotizacion.id}/anular`).set(auth).expect(409);
  });

  test("anula y filtra por vigencia, y bloquea ventas de las cotizaciones cerradas", async () => {
    const datos = datosCotizacion();
    const { body: anulable } = await cotizar(datos).expect(201);
    const { body: vencible } = await cotizar().expect(201);
    await prisma.cotizacion.update({ where: { id: vencible.id }, data: { vigenteHasta: new Date("2000-01-01") } });
    const { body: vencidas } = await request(app).get("/api/cotizaciones?estado=vencida").set(auth).expect(200);
    expect(vencidas).toMatchObject({ total: 1, filas: [{ id: vencible.id, estado: "vencida" }] });
    const { body: anulada } = await request(app).post(`/api/cotizaciones/${anulable.id}/anular`).set(auth).expect(200);
    expect(anulada.estado).toBe("anulada");
    await abrirCaja();
    await cobrar(datos, anulable).expect(409);
    await cobrar(datos, vencible).expect(409);
    expect(await prisma.venta.count()).toBe(0);
  });

  test("el detalle relacional conserva el orden y los datos históricos si se borra un producto", async () => {
    const eliminado = await crearProducto({ stock: 0, precioVenta: 30, nombre: "Nombre original" });
    const { body: cotizacion } = await cotizar(datosCotizacion({
      items: [
        { productoId: eliminado.id, cantidad: 2 },
        { productoId: producto.id, cantidad: 1 },
        { productoId: eliminado.id, cantidad: 1 },
      ],
    })).expect(201);
    await request(app).delete(`/api/productos/${eliminado.id}`).set(auth).expect(204);
    const filas = await prisma.cotizacionItem.findMany({
      where: { cotizacionId: cotizacion.id }, orderBy: { posicion: "asc" },
      include: { identidadProducto: { include: { producto: { select: { id: true } } } } },
    });
    expect(filas.map(({ identidadProducto }) => identidadProducto.producto?.id ?? null)).toEqual([null, producto.id, null]);
    expect(filas.map(({ productoReferencia }) => productoReferencia)).toEqual([eliminado.id, producto.id, eliminado.id]);
    const { body: detalle } = await request(app).get(`/api/cotizaciones/${cotizacion.id}`).set(auth).expect(200);
    expect(detalle.items).toEqual(cotizacion.items);
    expect(detalle.total).toBe(180);
  });

  test("registra una merma por bodega con costo histórico y evita descontarla dos veces", async () => {
    const endpoint = `/api/productos/${producto.id}/movimientos`;
    const datos = {
      tipo: "salida", cantidad: 3, bodegaId: principal.id, causaMerma: "vencimiento", operacionId: randomUUID(),
    };
    const enviar = (cambios = {}) => request(app).post(endpoint).set(auth).send({ ...datos, ...cambios });
    await enviar({ tipo: "entrada" }).expect(400);
    await enviar({ causaMerma: "otra" }).expect(400);
    const { body: merma } = await enviar().expect(201);
    expect(merma).toMatchObject({ origen: "merma", costoMerma: "2.25", causaMerma: "vencimiento", stockResultante: 7 });
    expect((await enviar().expect(201)).body.id).toBe(merma.id);
    await enviar({ cantidad: 4 }).expect(409);
    const vacia = await prisma.bodega.create({ data: { nombre: "Bodega vacía" } });
    await enviar({ bodegaId: vacia.id, operacionId: randomUUID() }).expect(409);
    await prisma.producto.update({ where: { id: producto.id }, data: { precioCompra: 55 } });
    const { body: k } = await request(app).get("/api/bodegas/kardex?origen=merma&causaMerma=vencimiento").set(auth).expect(200);
    expect(k).toMatchObject({ total: 1, salidas: 3, valorMermas: "6.75", filas: [{ id: merma.id }] });
    expect(await stockDeProducto(producto.id)).toBe(7);
  });
});
