-- AlterTable
ALTER TABLE "productos" ADD COLUMN "codigoBarras" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigoBarras_key" ON "productos"("codigoBarras");
