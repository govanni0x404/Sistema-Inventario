CREATE TABLE "registro_auditoria" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioAfectadoId" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registro_auditoria_usuarioId_idx" ON "registro_auditoria"("usuarioId");
CREATE INDEX "registro_auditoria_accion_idx" ON "registro_auditoria"("accion");
CREATE INDEX "registro_auditoria_fecha_idx" ON "registro_auditoria"("fecha");

ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuarioAfectadoId_fkey" FOREIGN KEY ("usuarioAfectadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
