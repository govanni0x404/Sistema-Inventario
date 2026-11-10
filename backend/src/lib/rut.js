// RUT chileno: cuerpo numérico + dígito verificador (0-9 o K), calculado con módulo 11.
// Acepta "12.345.678-5", "12345678-5" o "123456785" y lo devuelve normalizado "12.345.678-5".

function limpiarRut(rut) {
  return String(rut || "").replace(/[.\s-]/g, "").toUpperCase();
}

function digitoVerificador(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

function rutValido(rut) {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  return digitoVerificador(limpio.slice(0, -1)) === limpio.slice(-1);
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut);
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
}

module.exports = { rutValido, formatearRut };
