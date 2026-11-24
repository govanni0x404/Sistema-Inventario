import type { Devolucion, Venta } from "../types/venta";
import type { Negocio } from "../types/negocio";
import { LOCALE, money } from "./format";

function escapeHtml(value: string) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

const METODO_LABEL: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

export const folioComprobante = (id: string) => id.slice(0, 8).toUpperCase();
export const folioNotaCredito = (id: string) => `NC-${id.toUpperCase()}`;

function printDocument(negocio: Negocio, documento: {
  titulo: string;
  folio: string;
  fecha: string;
  contenido: string;
  mensaje?: string;
  aviso: string;
}) {
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return false;
  ventana.opener = null;

  const encabezado = [
    negocio.rut ? `RUT ${escapeHtml(negocio.rut)}` : "",
    negocio.giro ? escapeHtml(negocio.giro) : "",
    negocio.direccion ? escapeHtml(negocio.direccion) : "",
    negocio.telefono ? `Tel. ${escapeHtml(negocio.telefono)}` : "",
  ]
    .filter(Boolean)
    .join("<br />");
  const { titulo, folio, contenido, mensaje, aviso } = documento;
  const fecha = new Date(documento.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titulo)} ${escapeHtml(folio)}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 12px;
    color: #111;
    width: min(300px, 100%);
    margin: 0 auto;
    padding: 12px 0;
    overflow-wrap: anywhere;
  }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  .sub { text-align: center; color: #555; margin-bottom: 10px; font-size: 11px; }
  .linea { border-top: 1px dashed #888; margin: 8px 0; }
  .fila { display: flex; justify-content: space-between; gap: 8px; }
  .fila span:last-child:not(:only-child) { white-space: nowrap; }
  .detalle { color: #555; font-size: 11px; margin-bottom: 4px; }
  .meta { margin-bottom: 2px; }
  .total { font-size: 15px; font-weight: bold; margin-top: 4px; }
  .footer { text-align: center; margin-top: 14px; color: #555; font-size: 11px; }
  .negocio { text-align: center; color: #333; font-size: 11px; margin-bottom: 8px; }
  .tipo { text-align: center; font-weight: bold; letter-spacing: 1px; margin-top: 6px; }
  .aviso { text-align: center; color: #555; font-size: 10px; margin-top: 10px; }
</style>
</head>
<body>
  <h1>${escapeHtml(negocio.nombre)}</h1>
  ${encabezado ? `<div class="negocio">${encabezado}</div>` : ""}
  <div class="linea"></div>
  <div class="tipo">${escapeHtml(titulo)}</div>
  <div class="sub">N° ${escapeHtml(folio)}<br />${fecha}</div>
  ${contenido}
  ${mensaje ? `<div class="footer">${escapeHtml(mensaje)}</div>` : ""}
  <div class="aviso">${escapeHtml(aviso)}</div>
  <script>
    window.onload = function () {
      window.print();
    };
    window.onafterprint = function () {
      window.close();
    };
  </script>
</body>
</html>`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  return true;
}

// Conserva el folio utilizado por los comprobantes ya impresos.
export function printTicket(venta: Venta, negocio: Negocio) {
  const cliente = escapeHtml(venta.cliente?.nombre || "Cliente general");
  const filas = venta.items.map((it) => `
    <div class="fila"><span>${escapeHtml(it.producto?.nombre ?? it.productoId)}</span><span>${money(it.subtotal)}</span></div>
    <div class="fila detalle">
      <span>${it.cantidad} × ${money(it.precioUnitario)}${it.descuento > 0 ? ` · desc. ${money(it.descuento)}` : ""}</span>
    </div>`).join("");
  const filaDescuento = venta.descuento > 0 ? `
    <div class="fila"><span>Subtotal</span><span>${money(venta.subtotal)}</span></div>
    <div class="fila"><span>Descuento</span><span>-${money(venta.descuento)}</span></div>` : "";
  const pagos = venta.esCortesia
    ? `<div class="meta">Cortesía${venta.motivoCortesia ? ` · ${escapeHtml(venta.motivoCortesia)}` : ""}</div>`
    : venta.pagos.map((p) => `
        <div class="fila meta"><span>${escapeHtml(METODO_LABEL[p.metodoPago] ?? p.metodoPago)}</span><span>${money(p.monto)}</span></div>`).join("");
  const valorCortesia = venta.esCortesia
    ? `<div class="fila"><span>Valor de referencia</span><span>${money(venta.total)}</span></div>`
    : "";

  return printDocument(negocio, {
    titulo: "COMPROBANTE INTERNO DE VENTA",
    folio: folioComprobante(venta.id),
    fecha: venta.fecha,
    contenido: `
      <div class="meta">Cliente: ${cliente}</div>
      <div class="linea"></div>
      ${filas}
      <div class="linea"></div>
      ${filaDescuento}
      ${valorCortesia}
      <div class="fila total"><span>TOTAL COBRADO</span><span>${money(venta.esCortesia ? 0 : venta.total)}</span></div>
      <div class="linea"></div>
      ${pagos}`,
    mensaje: negocio.mensajeTicket || "¡Gracias por su compra!",
    aviso: "Comprobante interno. No válido como boleta.",
  });
}

export function printNotaCredito(venta: Venta, devolucion: Devolucion, negocio: Negocio) {
  const productos = new Map(venta.items.map((it) => [it.id, it.producto]));
  const filas = devolucion.items.map((it) => {
    const producto = productos.get(it.ventaItemId);
    return `
      <div class="fila"><span>${escapeHtml(producto?.nombre ?? "Producto devuelto")}</span><span>${money(it.subtotal)}</span></div>
      <div class="fila detalle">
        <span>Cantidad: ${it.cantidad}${producto?.sku ? ` · SKU ${escapeHtml(producto.sku)}` : ""}</span>
      </div>`;
  }).join("");
  const cliente = escapeHtml(venta.cliente?.nombre || "Cliente general");
  const metodo = devolucion.metodoReembolso;
  const reembolso = devolucion.total === 0
    ? "Sin reembolso"
    : metodo ? escapeHtml(METODO_LABEL[metodo] ?? metodo) : "Sin método registrado";

  return printDocument(negocio, {
    titulo: "NOTA DE CRÉDITO INTERNA",
    folio: folioNotaCredito(devolucion.id),
    fecha: devolucion.fecha,
    contenido: `
      <div class="meta">Comprobante original: ${folioComprobante(venta.id)}</div>
      <div class="meta">Cliente: ${cliente}</div>
      ${devolucion.usuario?.nombre ? `<div class="meta">Registró: ${escapeHtml(devolucion.usuario.nombre)}</div>` : ""}
      ${devolucion.motivo ? `<div class="meta">Motivo: ${escapeHtml(devolucion.motivo)}</div>` : ""}
      <div class="linea"></div>
      ${filas}
      <div class="linea"></div>
      <div class="fila total"><span>TOTAL REEMBOLSADO</span><span>${money(devolucion.total)}</span></div>
      <div class="meta">Reembolso: ${reembolso}</div>`,
    aviso: "Documento de uso interno.",
  });
}
