-- CreateTable
CREATE TABLE "venta_pagos" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "venta_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venta_pagos_ventaId_idx" ON "venta_pagos"("ventaId");

-- AddForeignKey
ALTER TABLE "venta_pagos" ADD CONSTRAINT "venta_pagos_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada venta existente se convierte en un único pago por el total (mismo método
-- que tenía la venta), antes de borrar la columna vieja.
INSERT INTO "venta_pagos" ("id", "ventaId", "metodoPago", "monto")
SELECT gen_random_uuid()::text, id, "metodoPago", total FROM "ventas";

-- AlterTable
ALTER TABLE "ventas" DROP COLUMN "metodoPago";
