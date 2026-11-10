const { z } = require("zod");
const prisma = require("../lib/prisma");
const { rutValido, formatearRut } = require("../lib/rut");

const NEGOCIO_ID = 1;
const POR_DEFECTO = { nombre: "Mi Negocio", rut: null, giro: null, direccion: null, telefono: null, email: null, mensajeTicket: null };

// Texto vacío → null (campo opcional sin valor).
const opcional = (max) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

const negocioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del negocio es obligatorio").max(80),
  rut: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .refine(rutValido, "RUT inválido (revisa el dígito verificador)")
      .transform(formatearRut)
      .nullable()
      .optional()
  ),
  giro: opcional(120),
  direccion: opcional(160),
  telefono: opcional(40),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Correo inválido").nullable().optional()
  ),
  mensajeTicket: opcional(200),
});

function serialize(n) {
  const { id, actualizadoEn, ...datos } = n;
  return datos;
}

async function obtenerNegocio(db = prisma) {
  const negocio = await db.negocio.findUnique({ where: { id: NEGOCIO_ID } });
  return negocio ? serialize(negocio) : { ...POR_DEFECTO };
}

async function guardarNegocio(db, datos) {
  const negocio = await db.negocio.upsert({
    where: { id: NEGOCIO_ID },
    update: datos,
    create: { id: NEGOCIO_ID, ...datos },
  });
  return serialize(negocio);
}

// GET /api/negocio — cualquier usuario autenticado (el comprobante lo necesita en Caja).
async function obtener(req, res) {
  res.json(await obtenerNegocio());
}

// PUT /api/negocio — solo admin.
async function actualizar(req, res) {
  const parsed = negocioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  res.json(await guardarNegocio(prisma, parsed.data));
}

module.exports = { obtener, actualizar, negocioSchema, obtenerNegocio, guardarNegocio };
