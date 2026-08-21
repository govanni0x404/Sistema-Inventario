const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { SECCIONES, permisosDeRol } = require("../lib/permisos");
const { registrarAuditoria } = require("../lib/auditoria");

// Roles configurables: todos los del catálogo salvo "admin" (nunca se consulta aquí —
// siempre tiene acceso total, así un admin no puede bloquearse a sí mismo).
async function rolesConfigurables() {
  return prisma.rol.findMany({ where: { nombre: { not: "admin" } }, orderBy: { nombre: "asc" } });
}

async function matriz() {
  const roles = await rolesConfigurables();
  const permisos = {};
  for (const rol of roles) {
    permisos[rol.nombre] = await permisosDeRol(rol.nombre);
  }
  return { roles: roles.map((r) => r.nombre), secciones: SECCIONES, permisos };
}

// GET /api/permisos
async function listar(req, res) {
  res.json(await matriz());
}

const actualizarSchema = z.object({
  cambios: z
    .array(
      z.object({
        rol: z.string().trim().min(1),
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

  const roles = await rolesConfigurables();
  const rolesPorNombre = new Map(roles.map((r) => [r.nombre, r]));
  const invalido = parsed.data.cambios.find((c) => !rolesPorNombre.has(c.rol));
  if (invalido) throw new HttpError(400, `Rol inválido: ${invalido.rol}`);

  await prisma.$transaction(async (tx) => {
    for (const c of parsed.data.cambios) {
      const rolId = rolesPorNombre.get(c.rol).id;
      const anterior = await tx.rolPermiso.findUnique({ where: { rolId_seccion: { rolId, seccion: c.seccion } } });
      const valorAnterior = anterior ? anterior.permitido : true; // sin fila = permitido por defecto

      await tx.rolPermiso.upsert({
        where: { rolId_seccion: { rolId, seccion: c.seccion } },
        update: { permitido: c.permitido },
        create: { rolId, seccion: c.seccion, permitido: c.permitido },
      });

      if (valorAnterior !== c.permitido) {
        await registrarAuditoria(tx, {
          accion: "permiso_actualizado",
          usuarioId: req.user.id,
          valorAnterior: String(valorAnterior),
          valorNuevo: String(c.permitido),
          detalle: `${c.rol} / ${c.seccion}`,
        });
      }
    }
  });

  res.json(await matriz());
}

module.exports = { listar, actualizar };
