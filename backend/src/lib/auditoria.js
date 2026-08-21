// Registra un evento administrativo/seguridad en RegistroAuditoria. `cliente` puede ser
// `prisma` o una `tx` de una transacción en curso — así el registro queda atado a la
// misma operación que lo origina cuando corresponde.
async function registrarAuditoria(
  cliente,
  { accion, usuarioId = null, usuarioAfectadoId = null, valorAnterior = null, valorNuevo = null, detalle = null }
) {
  await cliente.registroAuditoria.create({
    data: { accion, usuarioId, usuarioAfectadoId, valorAnterior, valorNuevo, detalle },
  });
}

module.exports = { registrarAuditoria };
