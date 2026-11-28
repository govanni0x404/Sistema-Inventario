const { randomUUID } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const HttpError = require("./HttpError");

const CATALOGO_BODEGAS_LOCK_KEY = 72100003;

const stockCajaInclude = {
  select: { cantidad: true, bodega: { select: { principal: true, activo: true } } },
};

function conStockCaja({ stockBodegas, ...producto }) {
  return {
    ...producto, stock: stockBodegas.reduce((total, fila) => total + fila.cantidad, 0),
    stockCaja: stockBodegas.find((fila) => fila.bodega.principal && fila.bodega.activo)?.cantidad ?? 0,
  };
}

async function bloquearProductos(tx, ids) {
  return tx.$queryRaw`
    SELECT id, activo, inventariable FROM productos WHERE id IN (${Prisma.join(ids)})
    ORDER BY id COLLATE "C" FOR NO KEY UPDATE
  `;
}

async function stockTotal(tx, productoId) {
  const [{ total }] = await tx.$queryRaw`
    SELECT coalesce(sum(cantidad), 0) AS total FROM stock_bodega WHERE "productoId" = ${productoId}
  `;
  return Number(total);
}

function validarStockTotal(stock) {
  if (stock < -2_147_483_648 || stock > 2_147_483_647) {
    throw new HttpError(409, "El saldo total del producto supera el rango disponible");
  }
  return stock;
}

async function crearProductoCatalogo(tx, datos) {
  const identidad = await tx.identidadProducto.create({
    data: { producto: { create: datos } }, include: { producto: true },
  });
  return identidad.producto;
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
async function inicializarStockProducto(tx, productoId, stockInicial, usuarioId) {
  const bodegas = await tx.bodega.findMany();
  const principal = bodegas.find((bodega) => bodega.principal);
  if (!principal) {
    throw new HttpError(500, "No hay una bodega principal configurada");
  }
  await tx.stockBodega.createMany({
    data: bodegas.map((bodega) => ({
      bodegaId: bodega.id,
      productoId,
      cantidad: bodega.principal ? stockInicial : 0,
    })),
  });
  if (stockInicial > 0) {
    await tx.movimientoStock.create({
      data: {
        productoId, bodegaId: principal.id, usuarioId,
        tipo: "entrada", origen: "saldo_inicial", cantidad: stockInicial, stockResultante: stockInicial,
        motivo: "Existencias al incorporar el producto",
      },
    });
  }
}

module.exports = {
  bodegaPrincipal,
  ajustarStockBodega,
  bloquearCatalogoBodegas,
  inicializarStockProducto,
  stockCajaInclude,
  conStockCaja,
  bloquearProductos,
  stockTotal,
  validarStockTotal,
  crearProductoCatalogo,
};
