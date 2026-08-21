function escapeCampo(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// El BOM al inicio hace que Excel detecte UTF-8 correctamente al abrir el CSV (si no,
// interpreta acentos/ñ con el codepage por defecto del sistema y se ven mal).
const BOM = String.fromCharCode(0xfeff);

export function exportarCsv(nombreArchivo: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) return;
  const headers = Object.keys(filas[0]);
  const lineas = [headers.join(","), ...filas.map((f) => headers.map((h) => escapeCampo(f[h])).join(","))];
  const csv = BOM + lineas.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
