-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "turnoCajaId" TEXT;

-- CreateTable
CREATE TABLE "tipos_turno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id" TEXT NOT NULL,
    "tipoTurnoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "montoInicial" DECIMAL(10,2) NOT NULL,
    "montoContado" DECIMAL(10,2),
    "montoEsperado" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "notas" TEXT,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "usuarioAperturaId" TEXT,
    "usuarioCierreId" TEXT,

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_turno_nombre_key" ON "tipos_turno"("nombre");

-- CreateIndex
CREATE INDEX "turnos_caja_estado_idx" ON "turnos_caja"("estado");

-- CreateIndex
CREATE INDEX "ventas_turnoCajaId_idx" ON "ventas"("turnoCajaId");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_tipoTurnoId_fkey" FOREIGN KEY ("tipoTurnoId") REFERENCES "tipos_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_usuarioAperturaId_fkey" FOREIGN KEY ("usuarioAperturaId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_usuarioCierreId_fkey" FOREIGN KEY ("usuarioCierreId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
