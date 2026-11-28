BEGIN;

SET LOCAL lock_timeout = '10s';
LOCK TABLE "productos", "stock_bodega", "toma_inventario_items", "cotizacion_items",
    "orden_compra_items", "operaciones_compra", "operacion_compra_items", "turnos_caja",
    "ventas", "venta_items" IN ACCESS EXCLUSIVE MODE;

-- Compara cada campo derivado con sus datos de origen antes de retirarlo.
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM productos p
        WHERE p.stock <> (SELECT coalesce(sum(s.cantidad), 0) FROM stock_bodega s WHERE s."productoId" = p.id)
    ) THEN
        RAISE EXCEPTION 'El stock total no coincide con los saldos por bodega';
    END IF;
    IF EXISTS (
        SELECT FROM orden_compra_items i
        WHERE i.recibida <> (
            SELECT coalesce(sum(l.cantidad), 0)
            FROM operacion_compra_items l JOIN operaciones_compra o ON o.id = l."operacionId"
            WHERE l."itemId" = i.id AND o.tipo = 'recepcion'
        )
    ) THEN
        RAISE EXCEPTION 'Las unidades recibidas no coinciden con las recepciones';
    END IF;
    IF EXISTS (SELECT FROM venta_items WHERE subtotal <> "precioUnitario" * cantidad - descuento)
       OR EXISTS (
           SELECT FROM ventas
           WHERE subtotal <> total + descuento
             -- El subtotal se incorporó con valor cero para las ventas previas a los descuentos.
             AND NOT (subtotal = 0 AND descuento = 0)
       ) THEN
        RAISE EXCEPTION 'Un subtotal guardado no coincide con los importes registrados';
    END IF;
    IF EXISTS (
        SELECT FROM turnos_caja
        WHERE (estado = 'abierto') IS DISTINCT FROM ("fechaCierre" IS NULL)
           OR diferencia IS DISTINCT FROM ("montoContado" - "montoEsperado")
    ) THEN
        RAISE EXCEPTION 'Un turno no coincide con su fecha de cierre o arqueo';
    END IF;
END $$;

CREATE TABLE "identidades_producto" ("id" TEXT NOT NULL PRIMARY KEY);
INSERT INTO "identidades_producto" ("id")
SELECT id FROM "productos"
UNION SELECT "productoReferencia" FROM "toma_inventario_items"
UNION SELECT "productoReferencia" FROM "cotizacion_items";

ALTER TABLE "productos" ADD CONSTRAINT "productos_id_fkey"
    FOREIGN KEY ("id") REFERENCES "identidades_producto"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "toma_inventario_items" ADD CONSTRAINT "toma_inventario_items_productoReferencia_fkey"
    FOREIGN KEY ("productoReferencia") REFERENCES "identidades_producto"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cotizacion_items" ADD CONSTRAINT "cotizacion_items_productoReferencia_fkey"
    FOREIGN KEY ("productoReferencia") REFERENCES "identidades_producto"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "toma_inventario_items"
    DROP COLUMN "productoId",
    ADD CONSTRAINT "toma_inventario_items_conteo_valido" CHECK ("posicion" > 0 AND "stockContado" >= 0);
ALTER TABLE "cotizacion_items"
    DROP COLUMN "productoId",
    ADD CONSTRAINT "cotizacion_items_importes_validos" CHECK (
        "posicion" > 0 AND "cantidad" > 0 AND "precioUnitario" >= 0
        AND "descuento" BETWEEN 0 AND "precioUnitario" * "cantidad"
    );
CREATE INDEX "toma_inventario_items_productoReferencia_idx" ON "toma_inventario_items"("productoReferencia");
CREATE INDEX "cotizacion_items_productoReferencia_idx" ON "cotizacion_items"("productoReferencia");

ALTER TABLE "productos" DROP COLUMN "stock";
ALTER TABLE "orden_compra_items"
    DROP COLUMN "recibida",
    ADD CONSTRAINT "orden_compra_items_pedido_valido" CHECK ("cantidad" > 0 AND "costoUnitario" >= 0);
ALTER TABLE "ventas" DROP COLUMN "subtotal";
ALTER TABLE "venta_items" DROP COLUMN "subtotal";

ALTER TABLE "turnos_caja" DROP COLUMN "diferencia", DROP COLUMN "estado";
CREATE INDEX "turnos_caja_fechaCierre_idx" ON "turnos_caja"("fechaCierre");
CREATE INDEX "turnos_caja_cajaId_fechaCierre_idx" ON "turnos_caja"("cajaId", "fechaCierre");
CREATE UNIQUE INDEX "turnos_caja_uno_abierto_por_caja_idx"
    ON "turnos_caja"("cajaId") WHERE "fechaCierre" IS NULL;

COMMIT;
