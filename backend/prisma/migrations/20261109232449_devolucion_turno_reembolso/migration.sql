-- AlterTable
ALTER TABLE "devoluciones" ADD COLUMN     "metodoReembolso" TEXT,
ADD COLUMN     "turnoCajaId" TEXT;

-- CreateIndex
CREATE INDEX "devoluciones_turnoCajaId_idx" ON "devoluciones"("turnoCajaId");

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
