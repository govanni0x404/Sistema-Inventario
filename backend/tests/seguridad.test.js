const { randomUUID } = require("node:crypto");
const request = require("supertest");
const app = require("../src/app");
const { sign } = require("../src/lib/jwt");
const { prisma, stockDeProducto, resetDb, crearUsuario, crearProducto, crearTipoTurno, crearBodegaPrincipal } = require("./helpers");

const bearer = (usuario) => ({ Authorization: `Bearer ${usuario.token}` });

async function bloquearSeccion(rolNombre, seccion) {
  const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
  await prisma.rolPermiso.create({ data: { rolId: rol.id, seccion, permitido: false } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Caja: reembolsos, idempotencia y dueño del turno", () => {
  let cajero, producto, turno;

  async function vender(usuario, body) {
    const res = await request(app).post("/api/ventas").set(bearer(usuario)).send(body);
    expect(res.status).toBe(201);
    return res.body;
  }

  beforeEach(async () => {
    await resetDb();
    await crearBodegaPrincipal();
    cajero = await crearUsuario({ rol: "cajero" });
    producto = await crearProducto({ stock: 20, precioVenta: 20 });
    const tipoTurno = await crearTipoTurno();
    const abrir = await request(app).post("/api/turnos").set(bearer(cajero)).send({ tipoTurnoId: tipoTurno.id, montoInicial: 100 });
    expect(abrir.status).toBe(201);
    turno = abrir.body;
  });

  test("con pago dividido no se reembolsa por un método más de lo pagado con él", async () => {
    const venta = await vender(cajero, {
      pagos: [
        { metodoPago: "efectivo", monto: 20 },
        { metodoPago: "tarjeta", monto: 20 },
      ],
      items: [{ productoId: producto.id, cantidad: 2 }],
    });
    const url = `/api/ventas/${venta.id}/devolucion`;
    const item = { ventaItemId: venta.items[0].id, cantidad: 1 };

    const primero = await request(app).post(url).set(bearer(cajero)).send({ metodoReembolso: "efectivo", items: [item] });
    expect(primero.status).toBe(201);
    expect(primero.body.total).toBe(20);

    // Ya se devolvieron los 20 pagados en efectivo: el segundo debe ir a tarjeta.
    const excede = await request(app).post(url).set(bearer(cajero)).send({ metodoReembolso: "efectivo", items: [item] });
    expect(excede.status).toBe(409);
    expect(excede.body.error).toMatch(/supera lo que queda por devolver con efectivo/);

    const conTarjeta = await request(app).post(url).set(bearer(cajero)).send({ metodoReembolso: "tarjeta", items: [item] });
    expect(conTarjeta.status).toBe(201);

    expect(await stockDeProducto(producto.id)).toBe(20);
  });

  test("un reembolso mayor que la parte en efectivo responde 409 sin tocar el stock", async () => {
    const venta = await vender(cajero, {
      pagos: [
        { metodoPago: "efectivo", monto: 10 },
        { metodoPago: "tarjeta", monto: 30 },
      ],
      items: [{ productoId: producto.id, cantidad: 2 }],
    });
    const res = await request(app).post(`/api/ventas/${venta.id}/devolucion`).set(bearer(cajero))
      .send({ metodoReembolso: "efectivo", items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] });
    expect(res.status).toBe(409);
    expect(await prisma.devolucion.count()).toBe(0);
    expect(await stockDeProducto(producto.id)).toBe(18);
  });

  test("una devolución con la misma clave se registra una sola vez", async () => {
    const venta = await vender(cajero, { pagos: [{ metodoPago: "efectivo", monto: 60 }], items: [{ productoId: producto.id, cantidad: 3 }] });
    const url = `/api/ventas/${venta.id}/devolucion`;
    const body = { claveIdempotencia: randomUUID(), items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] };

    const intentos = await Promise.all([
      request(app).post(url).set(bearer(cajero)).send(body),
      request(app).post(url).set(bearer(cajero)).send(body),
    ]);
    expect(intentos.map((r) => r.status)).toEqual([201, 201]);
    expect(intentos[0].body.id).toBe(intentos[1].body.id);
    expect(intentos[0].body.claveIdempotencia).toBeUndefined();
    expect(await prisma.devolucion.count()).toBe(1);
    expect(await stockDeProducto(producto.id)).toBe(18);

    const otrosDatos = await request(app).post(url).set(bearer(cajero))
      .send({ ...body, items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }] });
    expect(otrosDatos.status).toBe(409);

    // Sin clave sigue funcionando como siempre.
    const sinClave = await request(app).post(url).set(bearer(cajero)).send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] });
    expect(sinClave.status).toBe(201);
  });

  test("un movimiento de caja con la misma clave se registra una sola vez", async () => {
    const body = { claveIdempotencia: randomUUID(), tipo: "retiro", monto: 15, motivo: "Pago a proveedor" };
    const intentos = await Promise.all([
      request(app).post("/api/movimientos-caja").set(bearer(cajero)).send(body),
      request(app).post("/api/movimientos-caja").set(bearer(cajero)).send(body),
    ]);
    expect(intentos.map((r) => r.status)).toEqual([201, 201]);
    expect(intentos[0].body.id).toBe(intentos[1].body.id);
    expect(await prisma.movimientoCaja.count()).toBe(1);

    const otrosDatos = await request(app).post("/api/movimientos-caja").set(bearer(cajero)).send({ ...body, monto: 16 });
    expect(otrosDatos.status).toBe(409);
  });

  test("valida montos y textos de movimientos de caja y cierre", async () => {
    const largo = await request(app).post("/api/movimientos-caja").set(bearer(cajero))
      .send({ tipo: "retiro", monto: 1, motivo: "x".repeat(501) });
    expect(largo.status).toBe(400);
    const decimales = await request(app).post("/api/movimientos-caja").set(bearer(cajero))
      .send({ tipo: "retiro", monto: 1.234, motivo: "Prueba" });
    expect(decimales.status).toBe(400);

    for (const montoContado of ["", null, undefined, "abc", -1]) {
      const res = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(bearer(cajero)).send({ montoContado });
      expect(res.status).toBe(400);
    }
    const cierre = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(bearer(cajero)).send({ montoContado: "100" });
    expect(cierre.status).toBe(200);
    expect(cierre.body.montoContado).toBe(100);
  });

  test("otro usuario sin la sección 'turnos' no opera el turno ajeno", async () => {
    const otro = await crearUsuario({ rol: "vendedor" });
    await bloquearSeccion("vendedor", "turnos");
    const venta = await vender(cajero, { pagos: [{ metodoPago: "efectivo", monto: 20 }], items: [{ productoId: producto.id, cantidad: 1 }] });

    const vende = await request(app).post("/api/ventas").set(bearer(otro))
      .send({ pagos: [{ metodoPago: "efectivo", monto: 20 }], items: [{ productoId: producto.id, cantidad: 1 }] });
    expect(vende.status).toBe(403);
    const retira = await request(app).post("/api/movimientos-caja").set(bearer(otro)).send({ tipo: "retiro", monto: 5, motivo: "X" });
    expect(retira.status).toBe(403);
    const devuelve = await request(app).post(`/api/ventas/${venta.id}/devolucion`).set(bearer(otro))
      .send({ items: [{ ventaItemId: venta.items[0].id, cantidad: 1 }] });
    expect(devuelve.status).toBe(403);
    const cierra = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(bearer(otro)).send({ montoContado: 120 });
    expect(cierra.status).toBe(403);

    expect(await prisma.venta.count()).toBe(1);
    expect(await prisma.movimientoCaja.count()).toBe(0);
    expect(await prisma.devolucion.count()).toBe(0);
    expect((await prisma.turnoCaja.findUnique({ where: { id: turno.id } })).fechaCierre).toBeNull();
  });

  test("un supervisor (con 'turnos') o un admin sí pueden operar y cerrar el turno ajeno", async () => {
    const supervisor = await crearUsuario({ rol: "supervisor" });
    const admin = await crearUsuario({ rol: "admin" });

    const retira = await request(app).post("/api/movimientos-caja").set(bearer(supervisor)).send({ tipo: "retiro", monto: 5, motivo: "X" });
    expect(retira.status).toBe(201);
    const cierra = await request(app).post(`/api/turnos/${turno.id}/cerrar`).set(bearer(admin)).send({ montoContado: 95 });
    expect(cierra.status).toBe(200);
    expect(cierra.body.diferencia).toBe(0);
  });
});

describe("Sesiones: tokenVersion, rol inactivo y correos", () => {
  let admin, cajero;

  beforeEach(async () => {
    await resetDb();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
  });

  test("cambiar la contraseña invalida los tokens anteriores y entrega uno nuevo", async () => {
    const res = await request(app).put("/api/auth/password").set(bearer(cajero)).send({ actual: "test1234", nueva: "nuevaClave99" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const viejo = await request(app).get("/api/auth/me").set(bearer(cajero));
    expect(viejo.status).toBe(401);
    const nuevo = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(nuevo.status).toBe(200);
  });

  test("el reseteo por un admin y la desactivación cierran las sesiones del usuario", async () => {
    const reset = await request(app).put(`/api/usuarios/${cajero.usuario.id}/password`).set(bearer(admin)).send({ password: "otraClave123" });
    expect(reset.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(bearer(cajero))).status).toBe(401);

    const login = await request(app).post("/api/auth/login").send({ email: cajero.usuario.email, password: "otraClave123" });
    expect(login.status).toBe(200);
    const antes = (await prisma.usuario.findUnique({ where: { id: cajero.usuario.id } })).tokenVersion;

    const desactivar = await request(app).put(`/api/usuarios/${cajero.usuario.id}`).set(bearer(admin)).send({ activo: false });
    expect(desactivar.status).toBe(200);
    expect((await prisma.usuario.findUnique({ where: { id: cajero.usuario.id } })).tokenVersion).toBe(antes + 1);
    await request(app).put(`/api/usuarios/${cajero.usuario.id}`).set(bearer(admin)).send({ activo: true }).expect(200);
    // Reactivar no revive el token emitido antes de la desactivación.
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`)).status).toBe(401);
  });

  test("un token sin tokenVersion (emitido antes de esta versión) sigue valiendo mientras no cambie", async () => {
    const u = cajero.usuario;
    const legado = sign({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol.nombre });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${legado}`)).status).toBe(200);
    await prisma.usuario.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${legado}`)).status).toBe(401);
  });

  test("un rol desactivado no puede entrar ni usar su token", async () => {
    await prisma.rol.update({ where: { nombre: "cajero" }, data: { activo: false } });

    const conToken = await request(app).get("/api/productos").set(bearer(cajero));
    expect(conToken.status).toBe(403);
    const login = await request(app).post("/api/auth/login").send({ email: cajero.usuario.email, password: "test1234" });
    expect(login.status).toBe(403);
    expect(login.body.token).toBeUndefined();
  });

  test("el correo se guarda en minúsculas y no se repite cambiando mayúsculas", async () => {
    const creado = await request(app).post("/api/usuarios").set(bearer(admin))
      .send({ nombre: "Ana", email: "Ana.Perez@Tienda.CL", password: "claveSegura1", rol: "cajero" });
    expect(creado.status).toBe(201);
    expect(creado.body.email).toBe("ana.perez@tienda.cl");

    const repetido = await request(app).post("/api/usuarios").set(bearer(admin))
      .send({ nombre: "Ana 2", email: "ANA.PEREZ@tienda.cl", password: "claveSegura1", rol: "cajero" });
    expect(repetido.status).toBe(409);

    const corta = await request(app).post("/api/usuarios").set(bearer(admin))
      .send({ nombre: "Beto", email: "beto@tienda.cl", password: "1234567", rol: "cajero" });
    expect(corta.status).toBe(400);
    const larga = await request(app).post("/api/usuarios").set(bearer(admin))
      .send({ nombre: "Beto", email: "beto@tienda.cl", password: "x".repeat(73), rol: "cajero" });
    expect(larga.status).toBe(400);
  });
});

describe("Clientes: compras solo con la sección 'historial'", () => {
  test("sin 'historial' la ficha del cliente no trae ventas", async () => {
    await resetDb();
    const cajero = await crearUsuario({ rol: "cajero" });
    const cliente = await prisma.cliente.create({ data: { nombre: "Cliente X" } });
    await prisma.venta.create({ data: { clienteId: cliente.id, total: 10 } });

    const conPermiso = await request(app).get(`/api/clientes/${cliente.id}`).set(bearer(cajero));
    expect(conPermiso.status).toBe(200);
    expect(conPermiso.body.ventas).toHaveLength(1);

    await bloquearSeccion("cajero", "historial");
    const sinPermiso = await request(app).get(`/api/clientes/${cliente.id}`).set(bearer(cajero));
    expect(sinPermiso.status).toBe(200);
    expect(sinPermiso.body.ventas).toEqual([]);
  });
});

describe("Configuración inicial en producción", () => {
  test("sin SETUP_CLAVE se rechaza", async () => {
    await resetDb();
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await request(app).post("/api/setup").send({
        negocio: { nombre: "Tienda" },
        admin: { nombre: "Dueña", email: "duena@tienda.cl", password: "claveSegura1" },
      });
      expect(res.status).toBe(403);
      expect(await prisma.usuario.count()).toBe(0);
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });
});
