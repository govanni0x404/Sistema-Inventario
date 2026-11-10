const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { sign } = require("../lib/jwt");
const { registrarAuditoria } = require("../lib/auditoria");
const { negocioSchema, guardarNegocio, obtenerNegocio } = require("./negocio.controller");
const { serializeUsuario } = require("./auth.controller");

// Candado propio (distinto al de turnos) para que dos configuraciones simultáneas no creen
// dos administradores.
const SETUP_LOCK_KEY = 72100002;

const UNIDADES_INICIALES = ["Pieza", "Kg", "Litro", "Caja", "Paquete", "Docena"];
const TIPOS_TURNO_INICIALES = ["Turno Mañana", "Turno Tarde"];

const setupSchema = z.object({
  // Si el servidor define SETUP_CLAVE, hay que enviarla (evita que un tercero "reclame"
  // una instalación recién publicada antes que el dueño).
  clave: z.string().optional(),
  negocio: negocioSchema,
  admin: z.object({
    nombre: z.string().trim().min(1, "Tu nombre es obligatorio"),
    email: z.string().trim().toLowerCase().email("Correo inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),
});

async function necesitaConfiguracion(db = prisma) {
  return (await db.usuario.count()) === 0;
}

// GET /api/setup — público. Dice si la instalación está vacía (mostrar la pantalla de
// configuración inicial) y el nombre del negocio (para la pantalla de login).
async function estado(req, res) {
  const [pendiente, negocio] = await Promise.all([necesitaConfiguracion(), obtenerNegocio()]);
  res.json({ necesitaConfiguracion: pendiente, requiereClave: Boolean(process.env.SETUP_CLAVE), nombreNegocio: negocio.nombre });
}

// POST /api/setup — público, pero SOLO funciona mientras no exista ningún usuario.
// Deja lista la instalación: datos del negocio, roles base, bodega principal, unidades,
// tipos de turno y el primer administrador (que queda con la sesión iniciada).
async function configurar(req, res) {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { clave, negocio, admin } = parsed.data;
  if (process.env.SETUP_CLAVE && clave !== process.env.SETUP_CLAVE) {
    throw new HttpError(403, "Clave de instalación incorrecta");
  }

  const passwordHash = await bcrypt.hash(admin.password, 10);

  const usuario = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})::text`;
    if (!(await necesitaConfiguracion(tx))) {
      throw new HttpError(409, "Este sistema ya está configurado. Inicia sesión.");
    }

    const rolAdmin = await tx.rol.upsert({
      where: { nombre: "admin" },
      update: { protegido: true, activo: true },
      create: { nombre: "admin", protegido: true },
    });
    await tx.rol.upsert({ where: { nombre: "cajero" }, update: {}, create: { nombre: "cajero" } });

    if ((await tx.unidad.count()) === 0) {
      await tx.unidad.createMany({ data: UNIDADES_INICIALES.map((nombre) => ({ nombre })) });
    }
    if (!(await tx.bodega.findFirst({ where: { principal: true } }))) {
      await tx.bodega.create({ data: { nombre: "Bodega Principal", principal: true } });
    }
    if ((await tx.tipoTurno.count()) === 0) {
      await tx.tipoTurno.createMany({ data: TIPOS_TURNO_INICIALES.map((nombre) => ({ nombre })) });
    }

    await guardarNegocio(tx, negocio);

    const creado = await tx.usuario.create({
      data: { nombre: admin.nombre, email: admin.email, password: passwordHash, rolId: rolAdmin.id },
      include: { rol: true },
    });
    await registrarAuditoria(tx, { accion: "configuracion_inicial", usuarioId: creado.id, detalle: `negocio: ${negocio.nombre}` });
    return creado;
  });

  const token = sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre });
  res.status(201).json({ token, usuario: await serializeUsuario(usuario) });
}

module.exports = { estado, configurar };
