-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "protegido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- Backfill: un Rol por cada nombre ya usado en usuarios/rol_permisos, más "admin" y
-- "cajero" garantizados aunque la tabla de usuarios esté vacía (ej. BD de test recién
-- migrada). "admin" queda protegido: todo el sistema lo compara como literal.
INSERT INTO "roles" ("id", "nombre", "protegido", "activo")
SELECT gen_random_uuid()::text, nombre, (nombre = 'admin'), true
FROM (
  SELECT DISTINCT rol AS nombre FROM "usuarios"
  UNION
  SELECT DISTINCT rol AS nombre FROM "rol_permisos"
  UNION
  SELECT 'admin' AS nombre
  UNION
  SELECT 'cajero' AS nombre
) AS distintos;
