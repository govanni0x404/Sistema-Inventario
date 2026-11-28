BEGIN;

-- Versión de sesión: al cambiar contraseña o desactivar la cuenta se incrementa y los
-- tokens firmados con la versión anterior dejan de servir.
ALTER TABLE "usuarios" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Idempotencia opcional de devoluciones y movimientos de caja (igual que en ventas).
ALTER TABLE "devoluciones"
  ADD COLUMN "claveIdempotencia" TEXT,
  ADD COLUMN "huellaSolicitud" TEXT;

ALTER TABLE "movimientos_caja"
  ADD COLUMN "claveIdempotencia" TEXT,
  ADD COLUMN "huellaSolicitud" TEXT;

CREATE UNIQUE INDEX "devoluciones_usuarioId_claveIdempotencia_key"
  ON "devoluciones" ("usuarioId", "claveIdempotencia");

CREATE UNIQUE INDEX "movimientos_caja_usuarioId_claveIdempotencia_key"
  ON "movimientos_caja" ("usuarioId", "claveIdempotencia");

-- Índices para las consultas por fecha (historial de stock, reportes y listado de turnos).
-- El índice compuesto cubre también las búsquedas solo por producto.
CREATE INDEX "movimientos_stock_productoId_fecha_idx" ON "movimientos_stock" ("productoId", "fecha");
DROP INDEX IF EXISTS "movimientos_stock_productoId_idx";
CREATE INDEX "devoluciones_fecha_idx" ON "devoluciones" ("fecha");
CREATE INDEX "turnos_caja_fechaApertura_idx" ON "turnos_caja" ("fechaApertura");

COMMIT;
