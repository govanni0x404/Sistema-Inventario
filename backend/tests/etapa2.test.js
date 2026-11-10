const request = require("supertest");
const app = require("../src/app");
const { prisma, resetDb, crearUsuario } = require("./helpers");
const { rutValido, formatearRut } = require("../src/lib/rut");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("RUT chileno", () => {
  test.each([["12.345.678-5"], ["12345678-5"], ["123456785"], ["11.111.111-1"], ["7.654.321-6"]])("%s es válido", (rut) => {
    expect(rutValido(rut)).toBe(true);
  });
  test.each([["12.345.678-9"], ["abc"], ["1-9"], [""]])("%s es inválido", (rut) => {
    expect(rutValido(rut)).toBe(false);
  });
  test("se formatea con puntos y guion", () => {
    expect(formatearRut("123456785")).toBe("12.345.678-5");
    expect(formatearRut("7654321-6")).toBe("7.654.321-6");
  });
});

describe("Datos del negocio", () => {
  let admin, cajero;

  beforeEach(async () => {
    await resetDb();
    admin = await crearUsuario({ rol: "admin" });
    cajero = await crearUsuario({ rol: "cajero" });
  });

  test("sin configurar devuelve valores por defecto", async () => {
    const res = await request(app).get("/api/negocio").set("Authorization", `Bearer ${cajero.token}`);
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Mi Negocio");
  });

  test("el admin guarda los datos y el RUT queda formateado", async () => {
    const res = await request(app)
      .put("/api/negocio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "Almacén Don Pepe", rut: "123456785", direccion: "Av. Siempre Viva 123", email: "" });
    expect(res.status).toBe(200);
    expect(res.body.rut).toBe("12.345.678-5");
    expect(res.body.email).toBeNull();

    const leido = await request(app).get("/api/negocio").set("Authorization", `Bearer ${cajero.token}`);
    expect(leido.body.nombre).toBe("Almacén Don Pepe");
  });

  test("rechaza un RUT con dígito verificador incorrecto", async () => {
    const res = await request(app)
      .put("/api/negocio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ nombre: "X", rut: "12.345.678-9" });
    expect(res.status).toBe(400);
  });

  test("un cajero no puede editar los datos del negocio", async () => {
    const res = await request(app).put("/api/negocio").set("Authorization", `Bearer ${cajero.token}`).send({ nombre: "X" });
    expect(res.status).toBe(403);
  });
});

describe("Cambiar mi contraseña", () => {
  let cajero;

  beforeEach(async () => {
    await resetDb();
    cajero = await crearUsuario({ rol: "cajero" }); // contraseña de prueba: test1234
  });

  test("con la contraseña actual correcta se cambia y se puede entrar con la nueva", async () => {
    const res = await request(app)
      .put("/api/auth/password")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ actual: "test1234", nueva: "nuevaClave99" });
    expect(res.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email: cajero.usuario.email, password: "nuevaClave99" });
    expect(login.status).toBe(200);
  });

  test("con la contraseña actual incorrecta responde 400", async () => {
    const res = await request(app)
      .put("/api/auth/password")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ actual: "equivocada", nueva: "nuevaClave99" });
    expect(res.status).toBe(400);
  });

  test("la nueva contraseña debe tener al menos 8 caracteres", async () => {
    const res = await request(app)
      .put("/api/auth/password")
      .set("Authorization", `Bearer ${cajero.token}`)
      .send({ actual: "test1234", nueva: "corta" });
    expect(res.status).toBe(400);
  });

  test("el login no distingue mayúsculas en el correo", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: cajero.usuario.email.toUpperCase(), password: "test1234" });
    expect(login.status).toBe(200);
  });
});

describe("Configuración inicial", () => {
  const datos = {
    negocio: { nombre: "Minimarket La Esquina", rut: "76.543.210-3" },
    admin: { nombre: "Dueña", email: "Duena@Tienda.cl", password: "claveSegura1" },
  };

  beforeEach(async () => {
    await resetDb();
  });

  test("con la base vacía indica que falta configurar", async () => {
    const res = await request(app).get("/api/setup");
    expect(res.status).toBe(200);
    expect(res.body.necesitaConfiguracion).toBe(true);
  });

  test("configura todo, deja la sesión iniciada y después se bloquea", async () => {
    const res = await request(app).post("/api/setup").send(datos);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.rol).toBe("admin");
    expect(res.body.usuario.email).toBe("duena@tienda.cl");

    expect(await prisma.bodega.count({ where: { principal: true } })).toBe(1);
    expect(await prisma.unidad.count()).toBeGreaterThan(0);
    expect(await prisma.tipoTurno.count()).toBeGreaterThan(0);
    expect(await prisma.rol.count({ where: { nombre: { in: ["admin", "cajero"] } } })).toBe(2);
    expect((await prisma.negocio.findUnique({ where: { id: 1 } })).nombre).toBe("Minimarket La Esquina");

    // El token sirve de inmediato
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);

    // Una segunda configuración ya no se permite
    const otra = await request(app).post("/api/setup").send(datos);
    expect(otra.status).toBe(409);
    const estado = await request(app).get("/api/setup");
    expect(estado.body.necesitaConfiguracion).toBe(false);
    expect(estado.body.nombreNegocio).toBe("Minimarket La Esquina");
  });

  test("dos configuraciones simultáneas crean un solo administrador", async () => {
    const respuestas = await Promise.all([
      request(app).post("/api/setup").send(datos),
      request(app)
        .post("/api/setup")
        .send({ ...datos, admin: { ...datos.admin, email: "otro@tienda.cl" } }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.usuario.count()).toBe(1);
  });

  test("si el servidor define SETUP_CLAVE, sin la clave correcta responde 403", async () => {
    process.env.SETUP_CLAVE = "secreta";
    try {
      const sin = await request(app).post("/api/setup").send(datos);
      expect(sin.status).toBe(403);
      const con = await request(app)
        .post("/api/setup")
        .send({ ...datos, clave: "secreta" });
      expect(con.status).toBe(201);
    } finally {
      delete process.env.SETUP_CLAVE;
    }
  });

  test("si ya hay usuarios, no se puede configurar", async () => {
    await crearUsuario({ rol: "admin" });
    const res = await request(app).post("/api/setup").send(datos);
    expect(res.status).toBe(409);
  });
});
