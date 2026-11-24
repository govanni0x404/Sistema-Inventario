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

// Usa enteros para conservar la precisión aun cuando el producto de los factores es grande.
function proporcionRedondeada(importe, numerador, denominador) {
  if (denominador === 0) return 0;
  const divisor = BigInt(denominador);
  return Number((BigInt(importe) * BigInt(numerador) + divisor / 2n) / divisor);
}

module.exports = { aCentavos, MAX_CENTAVOS, montoEnCentavos, proporcionRedondeada };
