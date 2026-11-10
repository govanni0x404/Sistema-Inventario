import type { Venta } from "../types/venta";
import type { Negocio } from "../types/negocio";
import { LOCALE, money } from "./format";

function escapeHtml(value: string) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

const METODO_LABEL: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Comprobante interno de venta (no es boleta: la boleta la emite la máquina de pago o el SII).
export function printTicket(venta: Venta, negocio: Negocio) {
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return;

  const encabezado = [
    negocio.rut ? `RUT ${escapeHtml(negocio.rut)}` : "",
    negocio.giro ? escapeHtml(negocio.giro) : "",
    negocio.direccion ? escapeHtml(negocio.direccion) : "",
    negocio.telefono ? `Tel. ${escapeHtml(negocio.telefono)}` : "",
  ]
    .filter(Boolean)
    .join("<br />");
  const mensaje = escapeHtml(negocio.mensajeTicket || "¡Gracias por su compra!");
  const metodo = (m: string) => escapeHtml(METODO_LABEL[m] ?? m);

  const fecha = new Date(venta.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" });
  const cliente = escapeHtml(venta.cliente?.nombre || "Cliente general");
  const folio = venta.id.slice(0, 8).toUpperCase();

  const filas = venta.items
    .map((it) => {
      const nombre = escapeHtml(it.producto?.nombre ?? it.productoId);
      return `
        <div class="fila">
          <span>${nombre}</span>
          <span>${money(it.subtotal)}</span>
        </div>
        <div class="fila detalle">
          <span>${it.cantidad} × ${money(it.precioUnitario)}${it.descuento > 0 ? ` · desc. ${money(it.descuento)}` : ""}</span>
        </div>`;
    })
    .join("");

  const filaDescuento =
    venta.descuento > 0
      ? `
        <div class="fila"><span>Subtotal</span><span>${money(venta.subtotal)}</span></div>
        <div class="fila"><span>Descuento</span><span>-${money(venta.descuento)}</span></div>`
      : "";

  const metodoPagoTexto = venta.esCortesia
    ? `Cortesía${venta.motivoCortesia ? ` (${escapeHtml(venta.motivoCortesia)})` : ""}`
    : venta.pagos.length > 1
      ? venta.pagos.map((p) => `${metodo(p.metodoPago)} ${money(p.monto)}`).join(" + ")
      : metodo(venta.pagos[0]?.metodoPago ?? "");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Comprobante ${folio}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 12px;
    color: #111;
    width: 300px;
    margin: 0 auto;
    padding: 12px 0;
  }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  .sub { text-align: center; color: #555; margin-bottom: 10px; font-size: 11px; }
  .linea { border-top: 1px dashed #888; margin: 8px 0; }
  .fila { display: flex; justify-content: space-between; gap: 8px; }
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
  <div class="tipo">COMPROBANTE DE VENTA</div>
  <div class="sub">N° ${folio}<br />${fecha}</div>
  <div class="meta">Cliente: ${cliente}</div>
  <div class="meta">Método de pago: ${metodoPagoTexto}</div>
  <div class="linea"></div>
  ${filas}
  <div class="linea"></div>
  ${filaDescuento}
  <div class="fila total"><span>TOTAL</span><span>${money(venta.total)}</span></div>
  <div class="footer">${mensaje}</div>
  <div class="aviso">Comprobante interno. No válido como boleta.</div>
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
}
