const HttpError = require("./HttpError");
const { aCentavos } = require("./dinero");

const calendario = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const hoy = () => calendario.format(new Date());
const include = {
  venta: { select: { id: true } },
  items: { orderBy: { posicion: "asc" } },
};

function lineasCotizacion(cotizacion) {
  return cotizacion.items.map(({ productoReferencia, nombre, codigo, cantidad, precioUnitario, descuento, gravado }) => ({
    productoId: productoReferencia, nombre, codigo, cantidad, precio: aCentavos(precioUnitario),
    descuento: aCentavos(descuento), gravado,
  }));
}

async function bloquearCotizacion(tx, id) {
  const [fila] = await tx.$queryRaw`SELECT id FROM cotizaciones WHERE id = ${id} FOR NO KEY UPDATE`;
  if (!fila) throw new HttpError(404, "Cotización no encontrada");
  return tx.cotizacion.findUniqueOrThrow({ where: { id }, include });
}

function estadoCotizacion(cotizacion) {
  if (cotizacion.venta) return "vendida";
  if (cotizacion.anuladaEn) return "anulada";
  return cotizacion.vigenteHasta.toISOString().slice(0, 10) >= hoy() ? "vigente" : "vencida";
}

module.exports = { hoy, include, bloquearCotizacion, estadoCotizacion, lineasCotizacion };
