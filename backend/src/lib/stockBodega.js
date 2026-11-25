const { randomUUID } = require("node:crypto");
const HttpError = require("./HttpError");

const CATALOGO_BODEGAS_LOCK_KEY = 72100003;

const stockCajaInclude = {
  where: { bodega: { principal: true, activo: true } },
  select: { cantidad: true },
};

function conStockCaja({ stockBodegas, ...producto }) {
  return { ...producto, stockCaja: stockBodegas[0]?.cantidad ?? 0 };
}

async function bodegaPrincipal(tx) {
  const bodega = await tx.bodega.findFirst({ where: { principal: true, activo: true } });
  if (!bodega) throw new HttpError(500, "No hay una bodega principal configurada");
  return bodega;
}

// Cada operación bloquea primero el producto. El bloqueo compartido de la bodega
// evita que se la desactive o elimine hasta que termine el ajuste.
async function ajustarStockBodega(tx, bodegaId, productoId, delta, permitirNegativo = false) {
  const [bodega] = await tx.$queryRaw`
    SELECT "activo" FROM "bodegas" WHERE "id" = ${bodegaId} FOR SHARE
  `;
  if (!bodega) throw new HttpError(404, "Bodega no encontrada");

  if (delta < 0 && !permitirNegativo) {
    const [stock] = await tx.$queryRaw`
      UPDATE "stock_bodega"
      SET "cantidad" = "cantidad" + ${delta}
      WHERE "bodegaId" = ${bodegaId} AND "productoId" = ${productoId}
        AND "cantidad" >= ${-delta}
      RETURNING "cantidad"
    `;
    if (!stock) throw new HttpError(409, "Stock insuficiente en la bodega");
    return stock.cantidad;
  }

  if (!bodega.activo) throw new HttpError(409, "La bodega de destino está inactiva");

  const [stock] = await tx.$queryRaw`
    INSERT INTO "stock_bodega" ("id", "bodegaId", "productoId", "cantidad")
    VALUES (${randomUUID()}, ${bodegaId}, ${productoId}, ${delta})
    ON CONFLICT ("bodegaId", "productoId") DO UPDATE
    SET "cantidad" = "stock_bodega"."cantidad" + EXCLUDED."cantidad"
    RETURNING "cantidad"
  `;
  return stock.cantidad;
}

// Serializa el alta de productos con el alta y la baja de bodegas para que no
// falten filas de stock inicial ni se intente asignar stock a una bodega borrada.
async function bloquearCatalogoBodegas(tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CATALOGO_BODEGAS_LOCK_KEY})::text`;
}

// Al crear un producto: la bodega principal recibe el stock inicial, el resto de
// bodegas ya existentes arrancan en 0 (para que el producto tenga fila en todas).
async function inicializarStockProducto(tx, productoId, stockInicial) {
  const bodegas = await tx.bodega.findMany();
  if (!bodegas.some((bodega) => bodega.principal)) {
    throw new HttpError(500, "No hay una bodega principal configurada");
  }
  await tx.stockBodega.createMany({
    data: bodegas.map((bodega) => ({
      bodegaId: bodega.id,
      productoId,
      cantidad: bodega.principal ? stockInicial : 0,
    })),
  });
}

module.exports = {
  bodegaPrincipal,
  ajustarStockBodega,
  bloquearCatalogoBodegas,
  inicializarStockProducto,
  stockCajaInclude,
  conStockCaja,
};
