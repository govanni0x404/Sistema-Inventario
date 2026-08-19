const { z } = require("zod");
const prisma = require("../lib/prisma");
const { SECCIONES, ROLES_CONFIGURABLES, permisosDeRol } = require("../lib/permisos");

async function matriz() {
  const permisos = {};
  for (const rol of ROLES_CONFIGURABLES) {
    permisos[rol] = await permisosDeRol(rol);
  }
  return { roles: ROLES_CONFIGURABLES, secciones: SECCIONES, permisos };
}

// GET /api/permisos
async function listar(req, res) {
  res.json(await matriz());
}

const actualizarSchema = z.object({
  cambios: z
    .array(
      z.object({
        rol: z.enum(ROLES_CONFIGURABLES),
        seccion: z.enum(SECCIONES),
        permitido: z.boolean(),
      })
    )
    .min(1),
});

// PUT /api/permisos
async function actualizar(req, res) {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }

  await prisma.$transaction(
    parsed.data.cambios.map((c) =>
      prisma.rolPermiso.upsert({
        where: { rol_seccion: { rol: c.rol, seccion: c.seccion } },
        update: { permitido: c.permitido },
        create: { rol: c.rol, seccion: c.seccion, permitido: c.permitido },
      })
    )
  );

  res.json(await matriz());
}

module.exports = { listar, actualizar };
