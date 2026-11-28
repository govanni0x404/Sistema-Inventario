import { LOCALE } from "./format";

const entero = new Intl.NumberFormat(LOCALE);

export function centavosCosto(monto: string, cantidad: number | bigint = 1) {
  const [pesos, fraccion = ""] = monto.split(".");
  return BigInt(`${pesos}${fraccion.padEnd(2, "0")}`) * BigInt(cantidad);
}

export function costoEnPesos(centavos: bigint) {
  const valor = centavos < 0n ? -centavos : centavos;
  const decimales = valor % 100n;
  return `${centavos < 0n ? "−" : ""}$${entero.format(valor / 100n)}${decimales ? `,${String(decimales).padStart(2, "0")}` : ""}`;
}
