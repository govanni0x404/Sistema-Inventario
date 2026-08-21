export interface RegistroAuditoria {
  id: string;
  accion: string;
  usuarioId: string | null;
  usuario: { id: string; nombre: string } | null;
  usuarioAfectadoId: string | null;
  usuarioAfectado: { id: string; nombre: string } | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  detalle: string | null;
  fecha: string;
}
