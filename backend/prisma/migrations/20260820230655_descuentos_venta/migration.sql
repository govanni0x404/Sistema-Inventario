-- AlterTable
ALTER TABLE "venta_items" ADD COLUMN     "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
