// Formato regional único de la app (Chile): pesos chilenos sin decimales y fechas es-CL.
// Todas las pantallas importan de aquí, así cambiar de país es tocar un solo archivo.
export const LOCALE = "es-CL";

const opcionesMoneda = {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
} as const;
const formatoMoneda = new Intl.NumberFormat(LOCALE, { ...opcionesMoneda, maximumFractionDigits: 0 });

/** $12.345 — pesos chilenos, sin decimales. */
export const money = (n: number) => formatoMoneda.format(Number(n || 0));
/** Igual que `money`: el peso chileno no tiene centavos, también en caja. */
export const moneyCaja = (n: number) => formatoMoneda.format(Number(n || 0));

/**
 * Los montos se guardan internamente en centavos, pero el CLP no tiene centavos:
 * todo monto digitado o calculado se redondea a pesos enteros (múltiplos de 100 centavos).
 */
export const aCentavos = (monto: number) => Math.round(monto * 100);
export const aPesosEnteros = (centavos: number) => Math.round(centavos / 100) * 100;
export const pisoPesosEnteros = (centavos: number) => Math.floor(centavos / 100) * 100;
/** Convierte un monto digitado (pesos) a centavos de pesos enteros. */
export const pesosACentavos = (monto: number) => aPesosEnteros(aCentavos(monto));

/** Valor para un <input> de monto en pesos enteros. */
export const montoInput = (n: number) => String(Math.round(n));
