// Formato regional único de la app (Chile): pesos chilenos sin decimales y fechas es-CL.
// Todas las pantallas importan de aquí, así cambiar de país es tocar un solo archivo.
export const LOCALE = "es-CL";

const formatoMoneda = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** $12.345 — pesos chilenos, sin decimales. */
export const money = (n: number) => formatoMoneda.format(Number(n || 0));

/** Valor para un <input> de monto: entero si no tiene centavos, si no con 2 decimales. */
export const montoInput = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};
