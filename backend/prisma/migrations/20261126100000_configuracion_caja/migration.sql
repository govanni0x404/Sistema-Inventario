BEGIN;

ALTER TABLE "negocio"
  ADD COLUMN "venderSinStock" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "agruparProductosCaja" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "documentoVentaDefecto" TEXT NOT NULL DEFAULT 'interno',
  ADD COLUMN "descuentoMaximoCaja" INTEGER NOT NULL DEFAULT 100,
  ADD CONSTRAINT "negocio_descuento_maximo_caja_valido" CHECK ("descuentoMaximoCaja" BETWEEN 0 AND 100);

ALTER TABLE "ventas" ADD COLUMN "tipoDocumento" TEXT NOT NULL DEFAULT 'interno';
ALTER TABLE "ventas_en_espera" ADD COLUMN "tipoDocumento" TEXT NOT NULL DEFAULT 'interno';

ALTER TABLE "productos"
  DROP CONSTRAINT "productos_stock_positivo",
  ADD CONSTRAINT "productos_stock_minimo_positivo" CHECK ("stockMinimo" >= 0);

ALTER TABLE "stock_bodega" DROP CONSTRAINT "stock_bodega_cantidad_positiva";

ALTER TABLE "movimientos_stock"
  DROP CONSTRAINT "movimientos_stock_cantidades_validas",
  ADD CONSTRAINT "movimientos_stock_cantidad_positiva" CHECK ("cantidad" > 0);

COMMIT;
