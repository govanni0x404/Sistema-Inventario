-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_nombre_key" ON "unidades"("nombre");

-- Backfill: una unidad por cada valor distinto ya usado en productos.unidad (texto libre).
INSERT INTO "unidades" ("id", "nombre", "activo")
SELECT gen_random_uuid()::text, unidad, true
FROM (SELECT DISTINCT unidad FROM "productos" WHERE unidad IS NOT NULL AND unidad <> '') AS distintos;

-- Presets comunes, solo si no chocan (case-insensitive) con algo ya migrado.
INSERT INTO "unidades" ("id", "nombre", "activo")
SELECT gen_random_uuid()::text, preset, true
FROM (VALUES ('Pieza'), ('Kg'), ('Litro'), ('Caja'), ('Paquete'), ('Docena')) AS presets(preset)
WHERE NOT EXISTS (
    SELECT 1 FROM "unidades" u WHERE lower(u.nombre) = lower(presets.preset)
);

-- AlterTable: agrega la FK y migra los datos antes de borrar la columna vieja.
ALTER TABLE "productos" ADD COLUMN "unidadId" TEXT;

UPDATE "productos" p
SET "unidadId" = u.id
FROM "unidades" u
WHERE p.unidad = u.nombre;

-- Cualquier fila sin match (no debería quedar ninguna) cae al preset "Pieza" para no romper el NOT NULL.
UPDATE "productos" p
SET "unidadId" = (SELECT id FROM "unidades" WHERE nombre = 'Pieza')
WHERE p."unidadId" IS NULL;

ALTER TABLE "productos" ALTER COLUMN "unidadId" SET NOT NULL;
ALTER TABLE "productos" DROP COLUMN "unidad";

-- CreateIndex
CREATE INDEX "productos_unidadId_idx" ON "productos"("unidadId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades"("id") ON UPDATE CASCADE;
