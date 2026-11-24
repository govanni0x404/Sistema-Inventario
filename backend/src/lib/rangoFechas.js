const HttpError = require("./HttpError");

// Convierte un parámetro de query "YYYY-MM-DD" en una fecha local (inicio o fin de ese día).
// Si viene con otro formato o es una fecha imposible, responde 400 en vez de un 500.
function fechaDeQuery(valor, { finDelDia = false, nombre = "fecha" } = {}) {
  const partes = typeof valor === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const [anio, mes, dia] = partes ? partes.slice(1).map(Number) : [0, 0, 0];
  const d = new Date(2000, 0, 1, 12);
  d.setFullYear(anio, mes - 1, dia);
  if (anio < 1 || d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    throw new HttpError(400, `Fecha inválida en "${nombre}" (usa el formato AAAA-MM-DD)`);
  }
  return finDelDia ? finDeDia(d) : inicioDeDia(d);
}

function inicioDeDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDeDia(fecha) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Usa componentes de fecha locales (no toISOString, que es UTC): con zonas horarias
// negativas (ej. America/Santiago, UTC-4), el fin de día local (23:59:59.999) cae en el
// día siguiente en UTC, y toISOString() devolvía esa fecha corrida.
function claveDia(fecha) {
  const d = new Date(fecha);
  const anio = String(d.getFullYear()).padStart(4, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const DIAS_PRESET_VALIDOS = [1, 7, 30, 90];
const DIAS_MAXIMO = 366;

function sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

function diaCalendario(fecha) {
  const utc = new Date(0);
  utc.setUTCFullYear(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return utc.getTime() / 86_400_000;
}

// Resuelve el rango de fechas de un reporte: `desde`/`hasta` (personalizado) tiene
// prioridad sobre `dias` (preset); sin ninguno de los dos, cae al preset de 30 días.
function resolverRango(query, ahora) {
  const { desde, hasta, dias: diasParam } = query;

  if (desde !== undefined || hasta !== undefined) {
    if (!desde || !hasta) throw new HttpError(400, "Indica la fecha de inicio y de fin del reporte");
    const rangoInicio = fechaDeQuery(desde, { nombre: "desde" });
    const rangoFin = fechaDeQuery(hasta, { nombre: "hasta", finDelDia: true });
    const dias = diaCalendario(rangoFin) - diaCalendario(rangoInicio) + 1;
    if (dias < 1 || dias > DIAS_MAXIMO) {
      throw new HttpError(400, `El rango del reporte debe abarcar entre 1 y ${DIAS_MAXIMO} días`);
    }
    return { rangoInicio, rangoFin, dias };
  }

  const dias = diasParam === undefined ? 30 : typeof diasParam === "string" ? Number(diasParam) : NaN;
  if (!DIAS_PRESET_VALIDOS.includes(dias)) {
    throw new HttpError(400, "Selecciona un período de 1, 7, 30 o 90 días");
  }
  const rangoFin = finDeDia(ahora);
  const rangoInicio = inicioDeDia(sumarDias(rangoFin, 1 - dias));
  return { rangoInicio, rangoFin, dias };
}

module.exports = { inicioDeDia, finDeDia, claveDia, resolverRango, fechaDeQuery, sumarDias };
