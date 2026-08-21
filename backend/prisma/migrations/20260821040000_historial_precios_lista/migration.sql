CREATE TABLE "historial_precios_lista" (
    "id" TEXT NOT NULL,
    "listaPrecioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precioAnterior" DECIMAL(10,2),
    "precioNuevo" DECIMAL(10,2),
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historial_precios_lista_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historial_precios_lista_listaPrecioId_idx" ON "historial_precios_lista"("listaPrecioId");
CREATE INDEX "historial_precios_lista_productoId_idx" ON "historial_precios_lista"("productoId");

ALTER TABLE "historial_precios_lista" ADD CONSTRAINT "historial_precios_lista_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "listas_precio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_precios_lista" ADD CONSTRAINT "historial_precios_lista_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historial_precios_lista" ADD CONSTRAINT "historial_precios_lista_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
