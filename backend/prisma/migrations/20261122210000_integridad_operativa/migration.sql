BEGIN;

-- Facturación histórica: solo las nuevas ventas tienen un costo confirmado.
ALTER TABLE "venta_items"
ADD COLUMN "costoUnitario" DECIMAL(10, 2);

-- Reglas que la aplicación ya aplica, también exigidas al escribir en PostgreSQL.
CREATE UNIQUE INDEX "bodegas_una_principal_idx" ON "bodegas" ("principal") WHERE "principal";
CREATE UNIQUE INDEX "turnos_caja_uno_abierto_idx" ON "turnos_caja" ("estado") WHERE "estado" = 'abierto';

ALTER TABLE "bodegas"
ADD CONSTRAINT "bodegas_principal_activa" CHECK (NOT "principal" OR "activo");

ALTER TABLE "turnos_caja"
ADD CONSTRAINT "turnos_caja_estado_valido" CHECK ("estado" IN ('abierto', 'cerrado')),
ADD CONSTRAINT "turnos_caja_montos_positivos" CHECK ("montoInicial" >= 0 AND "montoContado" >= 0);

ALTER TABLE "productos"
ADD CONSTRAINT "productos_stock_positivo" CHECK ("stock" >= 0 AND "stockMinimo" >= 0);

ALTER TABLE "stock_bodega"
ADD CONSTRAINT "stock_bodega_cantidad_positiva" CHECK ("cantidad" >= 0);

ALTER TABLE "movimientos_stock"
ADD CONSTRAINT "movimientos_stock_tipo_valido" CHECK ("tipo" IN ('entrada', 'salida')),
ADD CONSTRAINT "movimientos_stock_cantidades_validas" CHECK ("cantidad" > 0 AND "stockResultante" >= 0);

ALTER TABLE "movimientos_caja"
ADD CONSTRAINT "movimientos_caja_tipo_valido" CHECK ("tipo" IN ('ingreso', 'retiro')),
ADD CONSTRAINT "movimientos_caja_monto_positivo" CHECK ("monto" >= 0);

ALTER TABLE "venta_items"
ADD CONSTRAINT "venta_items_cantidad_positiva" CHECK ("cantidad" > 0),
ADD CONSTRAINT "venta_items_costo_positivo" CHECK ("costoUnitario" >= 0);

ALTER TABLE "devolucion_items"
ADD CONSTRAINT "devolucion_items_cantidad_positiva" CHECK ("cantidad" > 0);

ALTER TABLE "venta_en_espera_items"
ADD CONSTRAINT "venta_en_espera_items_cantidad_positiva" CHECK ("cantidad" > 0);

CREATE INDEX "registro_auditoria_usuarioAfectadoId_accion_fecha_idx"
ON "registro_auditoria" ("usuarioAfectadoId", "accion", "fecha");

COMMIT;
