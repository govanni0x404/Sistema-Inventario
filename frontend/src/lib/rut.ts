// RUT chileno (misma lógica que backend/src/lib/rut.js): módulo 11 con dígito 0-9 o K.
const limpiar = (rut: string) => rut.replace(/[.\s-]/g, "").toUpperCase();

function digitoVerificador(cuerpo: string) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}

export function rutValido(rut: string) {
  const l = limpiar(rut);
  return /^\d{7,8}[0-9K]$/.test(l) && digitoVerificador(l.slice(0, -1)) === l.slice(-1);
}

/** "123456785" → "12.345.678-5" (si no es válido, lo deja como está). */
export function formatearRut(rut: string) {
  if (!rutValido(rut)) return rut;
  const l = limpiar(rut);
  return `${l.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${l.slice(-1)}`;
}
