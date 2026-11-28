BEGIN;

LOCK TABLE "tomas_inventario", "cotizaciones" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "toma_inventario_items" (
    "tomaId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "productoReferencia" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "unidad" TEXT NOT NULL,
    "stockEsperado" INTEGER NOT NULL,
    "stockContado" INTEGER NOT NULL,
    CONSTRAINT "toma_inventario_items_pkey" PRIMARY KEY ("tomaId", "posicion"),
    CONSTRAINT "toma_inventario_items_tomaId_fkey" FOREIGN KEY ("tomaId") REFERENCES "tomas_inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "toma_inventario_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT "toma_inventario_items_valido" CHECK (
        "posicion" > 0 AND "stockContado" >= 0 AND ("productoId" IS NULL OR "productoId" = "productoReferencia")
    )
);

CREATE TABLE "cotizacion_items" (
    "cotizacionId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "productoReferencia" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL,
    "gravado" BOOLEAN NOT NULL,
    CONSTRAINT "cotizacion_items_pkey" PRIMARY KEY ("cotizacionId", "posicion"),
    CONSTRAINT "cotizacion_items_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cotizacion_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT "cotizacion_items_valido" CHECK (
        "posicion" > 0 AND "cantidad" > 0 AND "precioUnitario" >= 0
        AND "descuento" BETWEEN 0 AND "precioUnitario" * "cantidad"
        AND ("productoId" IS NULL OR "productoId" = "productoReferencia")
    )
);

CREATE INDEX "toma_inventario_items_productoId_idx" ON "toma_inventario_items"("productoId");
CREATE UNIQUE INDEX "toma_inventario_items_tomaId_productoReferencia_key" ON "toma_inventario_items"("tomaId", "productoReferencia");
CREATE INDEX "cotizacion_items_productoId_idx" ON "cotizacion_items"("productoId");

-- El vínculo al catálogo es opcional para conservar las líneas de productos eliminados.
INSERT INTO "toma_inventario_items"
    ("tomaId", "posicion", "productoReferencia", "productoId", "nombre", "codigoBarras", "unidad", "stockEsperado", "stockContado")
SELECT t.id, x.posicion, x.item->>'productoId', p.id, x.item->>'nombre', x.item->>'codigoBarras', x.item->>'unidad',
    (x.item->>'stockEsperado')::integer, (x.item->>'stockContado')::integer
FROM "tomas_inventario" t
CROSS JOIN LATERAL jsonb_array_elements(t.items) WITH ORDINALITY AS x(item, posicion)
LEFT JOIN "productos" p ON p.id = x.item->>'productoId';

INSERT INTO "cotizacion_items"
    ("cotizacionId", "posicion", "productoReferencia", "productoId", "nombre", "codigo", "cantidad", "precioUnitario", "descuento", "gravado")
SELECT c.id, x.posicion, x.item->>'productoId', p.id, x.item->>'nombre', x.item->>'codigo',
    (x.item->>'cantidad')::integer, (x.item->>'precio')::numeric / 100, (x.item->>'descuento')::numeric / 100,
    (x.item->>'gravado')::boolean
FROM "cotizaciones" c
CROSS JOIN LATERAL jsonb_array_elements(c.items) WITH ORDINALITY AS x(item, posicion)
LEFT JOIN "productos" p ON p.id = x.item->>'productoId';

-- Interrumpe la migración antes de retirar los datos originales si un documento no cuadra.
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM "tomas_inventario" t
        LEFT JOIN "toma_inventario_items" i ON i."tomaId" = t.id
        GROUP BY t.id
        HAVING count(i."tomaId") <> t.lineas
            OR count(*) FILTER (WHERE i."stockEsperado" <> i."stockContado") <> t.ajustes
    ) THEN
        RAISE EXCEPTION 'Una toma de inventario no coincide con su detalle migrado';
    END IF;

    IF EXISTS (
        SELECT FROM "cotizaciones" c
        LEFT JOIN "cotizacion_items" i ON i."cotizacionId" = c.id
        GROUP BY c.id
        HAVING count(i."cotizacionId") <> jsonb_array_length(c.items)
            OR c.total IS DISTINCT FROM (sum(i."precioUnitario" * i.cantidad - i.descuento) - c.descuento)
    ) THEN
        RAISE EXCEPTION 'Una cotización no coincide con su detalle migrado';
    END IF;
END $$;

CREATE UNIQUE INDEX "venta_pagos_ventaId_metodoPago_key" ON "venta_pagos"("ventaId", "metodoPago");
CREATE UNIQUE INDEX "devolucion_items_devolucionId_ventaItemId_key" ON "devolucion_items"("devolucionId", "ventaItemId");
DROP INDEX "venta_pagos_ventaId_idx";
DROP INDEX "devolucion_items_devolucionId_idx";

ALTER TABLE "tomas_inventario" DROP COLUMN "ajustes", DROP COLUMN "items", DROP COLUMN "lineas";
ALTER TABLE "cotizaciones" DROP COLUMN "items", DROP COLUMN "total";

COMMIT;
