BEGIN;

-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "causaMerma" TEXT,
ADD COLUMN     "costoMerma" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "cotizacionId" TEXT;

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "vigenteHasta" DATE NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anuladaEn" TIMESTAMP(3),
    "observaciones" TEXT,
    "usuarioNombre" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_folio_key" ON "cotizaciones"("folio");

-- CreateIndex
CREATE INDEX "cotizaciones_clienteId_idx" ON "cotizaciones"("clienteId");

-- CreateIndex
CREATE INDEX "cotizaciones_vigenteHasta_idx" ON "cotizaciones"("vigenteHasta");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_cotizacionId_key" ON "ventas"("cotizacionId");

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_merma_valida"
CHECK (("origen" = 'merma' AND "tipo" = 'salida' AND "causaMerma" IS NOT NULL AND "costoMerma" IS NOT NULL)
    OR ("origen" <> 'merma' AND "causaMerma" IS NULL AND "costoMerma" IS NULL));

COMMIT;

