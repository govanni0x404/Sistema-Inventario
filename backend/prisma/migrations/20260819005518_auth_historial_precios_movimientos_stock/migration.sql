-- CreateTable
CREATE TABLE "historial_precios" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precioCompraAnterior" DECIMAL(10,2) NOT NULL,
    "precioCompraNuevo" DECIMAL(10,2) NOT NULL,
    "precioVentaAnterior" DECIMAL(10,2) NOT NULL,
    "precioVentaNuevo" DECIMAL(10,2) NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "cantidad" INTEGER NOT NULL,
    "stockResultante" INTEGER NOT NULL,
    "motivo" TEXT,
    "ventaId" TEXT,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historial_precios_productoId_idx" ON "historial_precios"("productoId");

-- CreateIndex
CREATE INDEX "movimientos_stock_productoId_idx" ON "movimientos_stock"("productoId");

-- CreateIndex
CREATE INDEX "movimientos_stock_ventaId_idx" ON "movimientos_stock"("ventaId");

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
