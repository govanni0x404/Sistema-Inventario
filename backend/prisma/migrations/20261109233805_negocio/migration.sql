-- CreateTable
CREATE TABLE "negocio" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "giro" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "mensajeTicket" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocio_pkey" PRIMARY KEY ("id")
);

-- Una sola fila por instalación.
ALTER TABLE "negocio" ADD CONSTRAINT "negocio_una_fila" CHECK ("id" = 1);
