-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- Backfill: una categoría por cada valor distinto ya usado en productos.categoria (texto libre).
INSERT INTO "categorias" ("id", "nombre", "activo")
SELECT gen_random_uuid()::text, categoria, true
FROM (SELECT DISTINCT categoria FROM "productos" WHERE categoria IS NOT NULL AND categoria <> '') AS distintos;

-- AlterTable: agrega la FK y migra los datos antes de borrar la columna vieja.
ALTER TABLE "productos" ADD COLUMN "categoriaId" TEXT;

UPDATE "productos" p
SET "categoriaId" = c.id
FROM "categorias" c
WHERE p.categoria = c.nombre;

ALTER TABLE "productos" DROP COLUMN "categoria";

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
