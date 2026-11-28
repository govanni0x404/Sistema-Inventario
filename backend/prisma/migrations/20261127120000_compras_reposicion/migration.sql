-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('borrador', 'emitida', 'parcial', 'recibida', 'cerrada', 'anulada');

-- CreateEnum
CREATE TYPE "TipoOperacionCompra" AS ENUM ('recepcion', 'devolucion');

-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "operacionCompraId" TEXT;

-- AlterTable
ALTER TABLE "stock_bodega" ADD COLUMN     "stockMinimo" INTEGER;

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'borrador',
    "proveedorId" TEXT NOT NULL,
    "proveedorNombre" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "bodegaNombre" TEXT NOT NULL,
    "entregaEstimada" DATE,
    "nota" TEXT,
    "motivoCierre" TEXT,
    "creadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_items" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "recibida" INTEGER NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "orden_compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_compra" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipo" "TipoOperacionCompra" NOT NULL,
    "recepcionId" TEXT,
    "documento" TEXT NOT NULL,
    "nota" TEXT,
    "usuarioNombre" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacion_compra_items" (
    "operacionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "operacion_compra_items_pkey" PRIMARY KEY ("operacionId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_folio_key" ON "ordenes_compra"("folio");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_folio_idx" ON "ordenes_compra"("estado", "folio");

-- CreateIndex
CREATE INDEX "ordenes_compra_proveedorId_idx" ON "ordenes_compra"("proveedorId");

-- CreateIndex
CREATE INDEX "ordenes_compra_bodegaId_idx" ON "ordenes_compra"("bodegaId");

-- CreateIndex
CREATE INDEX "orden_compra_items_productoId_idx" ON "orden_compra_items"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_items_ordenId_productoId_key" ON "orden_compra_items"("ordenId", "productoId");

-- CreateIndex
CREATE INDEX "operaciones_compra_ordenId_fecha_idx" ON "operaciones_compra"("ordenId", "fecha");

-- CreateIndex
CREATE INDEX "operaciones_compra_recepcionId_idx" ON "operaciones_compra"("recepcionId");

-- CreateIndex
CREATE INDEX "operacion_compra_items_itemId_idx" ON "operacion_compra_items"("itemId");

-- CreateIndex
CREATE INDEX "movimientos_stock_operacionCompraId_idx" ON "movimientos_stock"("operacionCompraId");

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_operacionCompraId_fkey" FOREIGN KEY ("operacionCompraId") REFERENCES "operaciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_compra" ADD CONSTRAINT "operaciones_compra_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_compra" ADD CONSTRAINT "operaciones_compra_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "operaciones_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_compra_items" ADD CONSTRAINT "operacion_compra_items_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_compra_items" ADD CONSTRAINT "operacion_compra_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "orden_compra_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_bodega" ADD CONSTRAINT "stock_bodega_stock_minimo_valido" CHECK ("stockMinimo" >= 0);
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_cantidades_validas"
    CHECK ("cantidad" > 0 AND "recibida" BETWEEN 0 AND "cantidad" AND "costoUnitario" >= 0);
ALTER TABLE "operaciones_compra" ADD CONSTRAINT "operaciones_compra_recepcion_valida"
    CHECK (("tipo" = 'recepcion' AND "recepcionId" IS NULL) OR ("tipo" = 'devolucion' AND "recepcionId" IS NOT NULL));
ALTER TABLE "operacion_compra_items" ADD CONSTRAINT "operacion_compra_items_cantidad_valida" CHECK ("cantidad" > 0);

