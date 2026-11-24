ALTER TABLE "ventas"
ADD COLUMN "claveIdempotencia" TEXT,
ADD COLUMN "huellaSolicitud" TEXT;

CREATE UNIQUE INDEX "ventas_usuarioId_claveIdempotencia_key"
ON "ventas" ("usuarioId", "claveIdempotencia");
