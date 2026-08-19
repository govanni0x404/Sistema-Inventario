-- CreateTable
CREATE TABLE "devoluciones" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "motivo" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_items" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "ventaItemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "devolucion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devoluciones_ventaId_idx" ON "devoluciones"("ventaId");

-- CreateIndex
CREATE INDEX "devolucion_items_devolucionId_idx" ON "devolucion_items"("devolucionId");

-- CreateIndex
CREATE INDEX "devolucion_items_ventaItemId_idx" ON "devolucion_items"("ventaItemId");

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
