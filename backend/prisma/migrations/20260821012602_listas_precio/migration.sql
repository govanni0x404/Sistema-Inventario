-- CreateTable
CREATE TABLE "listas_precio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_lista" (
    "id" TEXT NOT NULL,
    "listaPrecioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "precios_lista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listas_precio_nombre_key" ON "listas_precio"("nombre");

-- CreateIndex
CREATE INDEX "precios_lista_productoId_idx" ON "precios_lista"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "precios_lista_listaPrecioId_productoId_key" ON "precios_lista"("listaPrecioId", "productoId");

-- AddForeignKey
ALTER TABLE "precios_lista" ADD CONSTRAINT "precios_lista_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_lista" ADD CONSTRAINT "precios_lista_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
