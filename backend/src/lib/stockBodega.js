const HttpError = require("./HttpError");

async function bodegaPrincipal(tx) {
  const bodega = await tx.bodega.findFirst({ where: { principal: true } });
  if (!bodega) throw new HttpError(500, "No hay una bodega principal configurada");
  return bodega;
}

// Ajusta (crea si no existe) el StockBodega de un producto en una bodega por un delta
// (positivo = entra, negativo = sale). Lanza si el resultado quedaría negativo.
async function ajustarStockBodega(tx, bodegaId, productoId, delta) {
  const existente = await tx.stockBodega.findUnique({
    where: { bodegaId_productoId: { bodegaId, productoId } },
  });
  const actual = existente?.cantidad ?? 0;
  const nuevo = actual + delta;
  if (nuevo < 0) {
    throw new HttpError(409, "Stock insuficiente en la bodega");
  }
  if (existente) {
    await tx.stockBodega.update({ where: { id: existente.id }, data: { cantidad: nuevo } });
  } else {
    await tx.stockBodega.create({ data: { bodegaId, productoId, cantidad: nuevo } });
  }
  return nuevo;
}

// Al crear un producto: la bodega principal recibe el stock inicial, el resto de
// bodegas ya existentes arrancan en 0 (para que el producto tenga fila en todas).
async function inicializarStockProducto(tx, productoId, stockInicial) {
  const bodegas = await tx.bodega.findMany();
  for (const b of bodegas) {
    await tx.stockBodega.create({
      data: { bodegaId: b.id, productoId, cantidad: b.principal ? stockInicial : 0 },
    });
  }
}

module.exports = { bodegaPrincipal, ajustarStockBodega, inicializarStockProducto };
