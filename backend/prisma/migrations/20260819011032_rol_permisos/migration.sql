-- CreateTable
CREATE TABLE "rol_permisos" (
    "id" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_rol_seccion_key" ON "rol_permisos"("rol", "seccion");
