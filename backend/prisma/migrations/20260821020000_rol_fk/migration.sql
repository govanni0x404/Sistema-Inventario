-- Backfill defensivo: si algún "usuarios.rol"/"rol_permisos.rol" no tiene fila
-- correspondiente en "roles" (no debería pasar, pero cubre drift), se crea aquí.
INSERT INTO "roles" ("id", "nombre", "protegido", "activo")
SELECT gen_random_uuid()::text, u."rol", false, true
FROM (SELECT DISTINCT "rol" FROM "usuarios") u
LEFT JOIN "roles" r ON r."nombre" = u."rol"
WHERE r."id" IS NULL;

INSERT INTO "roles" ("id", "nombre", "protegido", "activo")
SELECT gen_random_uuid()::text, rp."rol", false, true
FROM (SELECT DISTINCT "rol" FROM "rol_permisos") rp
LEFT JOIN "roles" r ON r."nombre" = rp."rol"
WHERE r."id" IS NULL;

-- usuarios: agregar rolId, backfill, NOT NULL, FK + índice, borrar la columna vieja.
ALTER TABLE "usuarios" ADD COLUMN "rolId" TEXT;
UPDATE "usuarios" u SET "rolId" = (SELECT id FROM "roles" r WHERE r."nombre" = u."rol");
ALTER TABLE "usuarios" ALTER COLUMN "rolId" SET NOT NULL;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "usuarios_rolId_idx" ON "usuarios"("rolId");
ALTER TABLE "usuarios" DROP COLUMN "rol";

-- rol_permisos: agregar rolId, backfill, NOT NULL, reemplazar el único (rol,seccion) por
-- (rolId,seccion), FK con cascade (si se borra un Rol de verdad, sus permisos van con él),
-- borrar la columna vieja.
ALTER TABLE "rol_permisos" ADD COLUMN "rolId" TEXT;
UPDATE "rol_permisos" rp SET "rolId" = (SELECT id FROM "roles" r WHERE r."nombre" = rp."rol");
ALTER TABLE "rol_permisos" ALTER COLUMN "rolId" SET NOT NULL;
DROP INDEX IF EXISTS "rol_permisos_rol_seccion_key";
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "rol_permisos_rolId_seccion_key" ON "rol_permisos"("rolId", "seccion");
ALTER TABLE "rol_permisos" DROP COLUMN "rol";
