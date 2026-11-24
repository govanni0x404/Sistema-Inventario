ALTER TABLE "productos"
  ADD COLUMN "subfamilia" TEXT,
  ADD COLUMN "tipoImpuesto" TEXT NOT NULL DEFAULT 'iva19',
  ADD COLUMN "ventaPublico" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inventariable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "mostrarPrecio" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ventaVolumen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "esPack" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "imagenExterna" TEXT,
  ADD CONSTRAINT "productos_tipo_impuesto_valido" CHECK ("tipoImpuesto" IN ('iva19', 'exento'));

ALTER TABLE "venta_items" ADD COLUMN "inventariable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "productos_imagenes" (
  "productoId" TEXT NOT NULL PRIMARY KEY REFERENCES "productos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "mime" TEXT NOT NULL,
  "datos" BYTEA NOT NULL,
  "actualizadoEn" TIMESTAMP(3) NOT NULL
);

CREATE SEQUENCE "producto_ean13_seq" START WITH 1 MAXVALUE 9999999999;
