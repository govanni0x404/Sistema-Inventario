-- CreateTable
CREATE TABLE "bodegas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bodegas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bodegas_nombre_key" ON "bodegas"("nombre");

-- CreateTable
CREATE TABLE "stock_bodega" (
    "id" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_bodega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_bodega_bodegaId_productoId_key" ON "stock_bodega"("bodegaId", "productoId");
CREATE INDEX "stock_bodega_productoId_idx" ON "stock_bodega"("productoId");

-- AddForeignKey
ALTER TABLE "stock_bodega" ADD CONSTRAINT "stock_bodega_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_bodega" ADD CONSTRAINT "stock_bodega_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN "bodegaId" TEXT;
CREATE INDEX "movimientos_stock_bodegaId_idx" ON "movimientos_stock"("bodegaId");
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: crea la bodega principal y le asigna todo el stock actual de cada producto,
-- más el rastro de movimientos existentes (todos ocurrieron ahí, era la única bodega).
INSERT INTO "bodegas" ("id", "nombre", "principal", "activo")
VALUES (gen_random_uuid()::text, 'Bodega Principal', true, true);

INSERT INTO "stock_bodega" ("id", "bodegaId", "productoId", "cantidad")
SELECT gen_random_uuid()::text, (SELECT id FROM "bodegas" WHERE principal = true), id, stock
FROM "productos";

UPDATE "movimientos_stock"
SET "bodegaId" = (SELECT id FROM "bodegas" WHERE principal = true);
