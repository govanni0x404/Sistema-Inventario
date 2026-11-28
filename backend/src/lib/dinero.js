const { z } = require("zod");

const MAX_CENTAVOS = 9_999_999_999; // Decimal(10, 2)

function aCentavos(monto) {
  return Math.round(Number(monto) * 100);
}

const montoEnCentavos = z.preprocess(
  (valor) => typeof valor === "string" && valor.trim() ? Number(valor) : valor,
  z.number().finite().nonnegative().max(MAX_CENTAVOS / 100)
    .refine((monto) => Math.abs(monto * 100 - aCentavos(monto)) < 0.00001, "Usa hasta dos decimales")
    .transform(aCentavos),
);

// Mismo control que montoEnCentavos (máximo de Decimal(10, 2), hasta dos decimales, vacío
// o null = inválido) pero devuelve pesos, para los campos que se guardan tal cual en la BD.
const montoEnPesos = montoEnCentavos.transform((centavos) => centavos / 100);

// Usa enteros para conservar la precisión aun cuando el producto de los factores es grande.
function proporcionRedondeada(importe, numerador, denominador) {
  if (denominador === 0) return 0;
  const divisor = BigInt(denominador);
  return Number((BigInt(importe) * BigInt(numerador) + divisor / 2n) / divisor);
}

function subtotalLineaCentavos({ precioUnitario, cantidad, descuento }) {
  return aCentavos(precioUnitario) * cantidad - aCentavos(descuento);
}

module.exports = { aCentavos, MAX_CENTAVOS, montoEnCentavos, montoEnPesos, proporcionRedondeada, subtotalLineaCentavos };
