CREATE TABLE "cajas" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nombre" TEXT NOT NULL UNIQUE,
  "fondoFijo" DECIMAL(10,2) CHECK ("fondoFijo" >= 0),
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "activa" BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX "cajas_una_principal_idx" ON "cajas" ("principal") WHERE "principal";
INSERT INTO "cajas" ("id", "nombre", "fondoFijo", "principal")
VALUES ('00000000-0000-4000-8000-000000000001', 'Caja principal',
  (SELECT "montoInicial" FROM "turnos_caja" ORDER BY "fechaApertura" DESC, "id" DESC LIMIT 1), true);

ALTER TABLE "turnos_caja" ADD COLUMN "cajaId" TEXT;
UPDATE "turnos_caja" SET "cajaId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "turnos_caja" ALTER COLUMN "cajaId" SET NOT NULL;
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cajaId_fkey"
  FOREIGN KEY ("cajaId") REFERENCES "cajas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "turnos_caja_cajaId_estado_idx" ON "turnos_caja" ("cajaId", "estado");
DROP INDEX "turnos_caja_uno_abierto_idx";
CREATE UNIQUE INDEX "turnos_caja_uno_abierto_por_caja_idx"
  ON "turnos_caja" ("cajaId") WHERE "estado" = 'abierto';
