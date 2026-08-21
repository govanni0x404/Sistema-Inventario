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
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const DIAS_PRESET_VALIDOS = [1, 7, 30, 90];

// Resuelve el rango de fechas de un reporte: `desde`/`hasta` (personalizado) tiene
// prioridad sobre `dias` (preset); sin ninguno de los dos, cae al preset de 30 días.
function resolverRango(query, ahora) {
  const { desde, hasta, dias: diasParam } = query;

  if (desde && hasta) {
    const rangoInicio = inicioDeDia(new Date(`${desde}T00:00:00`));
    const rangoFin = finDeDia(new Date(`${hasta}T00:00:00`));
    if (!isNaN(rangoInicio.getTime()) && !isNaN(rangoFin.getTime()) && rangoInicio <= rangoFin) {
      const dias = Math.min(366, Math.round((rangoFin - rangoInicio) / 86400000) + 1);
      return { rangoInicio, rangoFin, dias };
    }
  }

  const diasSolicitados = parseInt(diasParam, 10);
  const dias = DIAS_PRESET_VALIDOS.includes(diasSolicitados) ? diasSolicitados : 30;
  const rangoFin = finDeDia(ahora);
  const rangoInicio = inicioDeDia(new Date(ahora.getTime() - (dias - 1) * 86400000));
  return { rangoInicio, rangoFin, dias };
}

module.exports = { inicioDeDia, finDeDia, claveDia, resolverRango };
