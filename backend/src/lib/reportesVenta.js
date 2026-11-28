const { Prisma } = require("@prisma/client");
const prisma = require("./prisma");

const subtotalLineaSql = Prisma.sql`(i."precioUnitario" * i.cantidad - i.descuento)`;

async function agruparProductosVendidos(desde, hasta, limite) {
  const grupos = await prisma.$queryRaw`
    SELECT i."productoId", sum(i.cantidad) AS cantidad, sum(${subtotalLineaSql}) AS subtotal
    FROM venta_items i JOIN ventas v ON v.id = i."ventaId"
    WHERE v.fecha BETWEEN (${desde} AT TIME ZONE 'UTC') AND (${hasta} AT TIME ZONE 'UTC')
      AND NOT v."esCortesia"
    GROUP BY i."productoId"
    ORDER BY subtotal DESC, i."productoId"
    LIMIT ${limite}
  `;
  return grupos.map(({ productoId, cantidad, subtotal }) => ({ productoId, cantidad: Number(cantidad), subtotal: Number(subtotal) }));
}

module.exports = { agruparProductosVendidos, subtotalLineaSql };
