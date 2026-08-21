-- DropForeignKey
ALTER TABLE "productos" DROP CONSTRAINT "productos_unidadId_fkey";

-- CreateTable
CREATE TABLE "ventas_en_espera" (
    "id" TEXT NOT NULL,
    "referencia" TEXT,
    "clienteId" TEXT,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_en_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_en_espera_items" (
    "id" TEXT NOT NULL,
    "ventaEnEsperaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "venta_en_espera_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venta_en_espera_items_ventaEnEsperaId_idx" ON "venta_en_espera_items"("ventaEnEsperaId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_en_espera" ADD CONSTRAINT "ventas_en_espera_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_en_espera" ADD CONSTRAINT "ventas_en_espera_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_en_espera_items" ADD CONSTRAINT "venta_en_espera_items_ventaEnEsperaId_fkey" FOREIGN KEY ("ventaEnEsperaId") REFERENCES "ventas_en_espera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_en_espera_items" ADD CONSTRAINT "venta_en_espera_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
