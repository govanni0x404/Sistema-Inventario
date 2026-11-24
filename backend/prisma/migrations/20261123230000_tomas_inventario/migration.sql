CREATE TABLE "tomas_inventario" (
    "id" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "bodegaNombre" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "lineas" INTEGER NOT NULL,
    "ajustes" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tomas_inventario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tomas_inventario_bodegaId_fecha_id_idx" ON "tomas_inventario"("bodegaId", "fecha", "id");
ALTER TABLE "movimientos_stock" ADD COLUMN "tomaInventarioId" TEXT;
CREATE INDEX "movimientos_stock_tomaInventarioId_idx" ON "movimientos_stock"("tomaInventarioId");
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_tomaInventarioId_fkey"
    FOREIGN KEY ("tomaInventarioId") REFERENCES "tomas_inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
