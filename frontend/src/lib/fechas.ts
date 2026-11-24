import { LOCALE } from "./format";

const calendarioChile = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const diaCorto = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const diaCompleto = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" });
const MAX_DIAS = 366;

export const hoyStr = () => calendarioChile.format(new Date());
export const fechaCorta = (fecha: string) => diaCorto.format(new Date(`${fecha}T00:00:00Z`));
export const fechaCompleta = (fecha: string) => diaCompleto.format(new Date(`${fecha}T00:00:00Z`));

export function validarRango(desde: string, hasta: string) {
  if (!desde || !hasta) return "Selecciona ambas fechas.";
  if (desde > hasta) return "La fecha de inicio debe ser anterior o igual a la fecha de término.";
  if ((Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1 > MAX_DIAS) {
    return `El período puede abarcar hasta ${MAX_DIAS} días.`;
  }
  return null;
}
