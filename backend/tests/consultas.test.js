const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");
const { finDeDia } = require("../src/lib/rangoFechas");

describe("Consultas — márgenes por producto", () => {
  let cajero, producto, tipoTurno;

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ stock: 10, precioCompra: 5, precioVenta: 20 });
    tipoTurno = await crearTipoTurno();

    await request(app)
      .post("/api/turnos")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("usa el costo de la venta y prorratea el descuento del ticket", async () => {
    const otro = await crearProducto({ stock: 10, precioCompra: 5, precioVenta: 20 });
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({
        pagos: [{ metodoPago: "efectivo", monto: 39.99 }],
        descuento: 0.01,
        items: [{ productoId: producto.id, cantidad: 1 }, { productoId: otro.id, cantidad: 1 }],
      });
    expect(venta.status).toBe(201);
    await prisma.venta.update({ where: { id: venta.body.id }, data: { fecha: new Date(finDeDia(new Date()).getTime() - 60_000) } });
    await prisma.producto.update({ where: { id: producto.id }, data: { precioCompra: 8 } });

    const res = await request(app).get("/api/consultas/productos-margen").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);
    expect(res.body.productos.map((p) => p.ingreso)).toEqual([20, 19.99]);

    const detalle = await request(app).get(`/api/ventas/${venta.body.id}`).set("Authorization", `Bearer ${cajero.token}`);
    expect(detalle.status).toBe(200);
    for (const item of detalle.body.items) {
      expect(item.costoUnitario).toBeUndefined();
      const fila = res.body.productos.find((p) => p.productoId === item.productoId);
      expect(fila.ingreso).toBe(item.importeCobrado);
      expect(fila.cantidad).toBe(1);
      expect(fila.costo).toBe(5);
      expect(fila.costoEstimado).toBe(false);
      expect(fila.margen).toBeCloseTo(fila.ingreso - 5);
    }
  });

  test("identifica el costo estimado cuando la venta histórica no lo registró", async () => {
    await prisma.venta.create({
      data: {
        total: 20,
        items: { create: { productoId: producto.id, cantidad: 1, precioUnitario: 20 } },
      },
    });
    await prisma.producto.update({ where: { id: producto.id }, data: { precioCompra: 8 } });

    const res = await request(app).get("/api/consultas/productos-margen").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);
    const fila = res.body.productos.find((p) => p.productoId === producto.id);
    expect(fila.costo).toBe(8);
    expect(fila.costoEstimado).toBe(true);
    expect(fila.margen).toBe(12);
    expect(fila.margenPct).toBe(60);
  });

  test("no cuenta ventas de cortesía en el margen", async () => {
    await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ esCortesia: true, motivoCortesia: "prueba", items: [{ productoId: producto.id, cantidad: 1 }] });

    const res = await request(app).get("/api/consultas/productos-margen").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);
    expect(res.body.productos.find((p) => p.productoId === producto.id)).toBeUndefined();

    const porUsuario = await request(app).get("/api/consultas/ventas-por-usuario").set("Authorization", `Bearer ${cajero.token}`);
    expect(porUsuario.status).toBe(200);
    expect(porUsuario.body.usuarios).toEqual([{
      usuarioId: cajero.usuario.id,
      nombre: cajero.usuario.nombre,
      cantidadVentas: 0,
      total: 0,
      cantidadCortesias: 1,
    }]);
  });

  test("detalla cada forma de pago y el reembolso, y permite buscar una venta por folio", async () => {
    const authorization = `Bearer ${cajero.token}`;
    const codigoBarras = "7806543";
    await prisma.producto.update({ where: { id: producto.id }, data: { codigoBarras } });
    const venta = await request(app)
      .post("/api/ventas")
      .set("Authorization", authorization)
      .send({
        pagos: [{ metodoPago: "efectivo", monto: 20 }, { metodoPago: "tarjeta", monto: 20 }],
        items: [{ productoId: producto.id, cantidad: 2 }],
      });
    expect(venta.status).toBe(201);
    const folio = venta.body.id.slice(0, 8).toUpperCase();
    const devolucion = await request(app)
      .post(`/api/ventas/${venta.body.id}/devolucion`)
      .set("Authorization", authorization)
      .send({ metodoReembolso: "efectivo", items: [{ ventaItemId: venta.body.items[0].id, cantidad: 1 }] });
    expect(devolucion.status).toBe(201);

    const pagos = await request(app).get(`/api/consultas/detalle-pagos?folio=${folio}`).set("Authorization", authorization);
    expect(pagos.status).toBe(200);
    expect(pagos.body.filas).toHaveLength(3);
    expect(pagos.body.filas).toEqual(expect.arrayContaining([
      expect.objectContaining({ ventaId: venta.body.id, operacion: "cobro", metodoPago: "tarjeta", monto: 20 }),
      expect.objectContaining({ ventaId: venta.body.id, operacion: "cobro", metodoPago: "efectivo", monto: 20 }),
      expect.objectContaining({ ventaId: venta.body.id, operacion: "reembolso", metodoPago: "efectivo", monto: -20 }),
    ]));
    const pagosFiltrados = await request(app).get("/api/consultas/detalle-pagos?metodo=tarjeta").set("Authorization", authorization);
    expect(pagosFiltrados.body.filas).toHaveLength(1);

    const historial = await request(app).get(`/api/ventas?folio=${folio}&tipo=con-devolucion`).set("Authorization", authorization);
    expect(historial.status).toBe(200);
    expect(historial.body).toEqual([
      expect.objectContaining({ id: venta.body.id, devoluciones: [{ id: devolucion.body.id, total: 20 }] }),
    ]);

    const detalle = await request(app)
      .get("/api/consultas/detalle-productos")
      .query({ producto: codigoBarras, folio })
      .set("Authorization", authorization);
    expect(detalle.status).toBe(200);
    expect(detalle.body.filas).toEqual([
      expect.objectContaining({ ventaId: venta.body.id, codigoBarras, cantidad: 2, cantidadDevuelta: 1, subtotal: 40 }),
    ]);
  });

  test("incluye los productos de cortesía en detalle y omite pagos vacíos", async () => {
    const authorization = `Bearer ${cajero.token}`;
    const cortesia = await request(app)
      .post("/api/ventas")
      .set("Authorization", authorization)
      .send({ esCortesia: true, motivoCortesia: "prueba", items: [{ productoId: producto.id, cantidad: 1 }] });
    expect(cortesia.status).toBe(201);

    const [productos, pagos] = await Promise.all([
      request(app).get("/api/consultas/detalle-productos").set("Authorization", authorization),
      request(app).get("/api/consultas/detalle-pagos").set("Authorization", authorization),
    ]);
    expect(productos.status).toBe(200);
    expect(pagos.status).toBe(200);
    expect(productos.body.filas).toEqual([expect.objectContaining({ ventaId: cortesia.body.id, esCortesia: true })]);
    expect(pagos.body.filas).toEqual([]);
  });
});
