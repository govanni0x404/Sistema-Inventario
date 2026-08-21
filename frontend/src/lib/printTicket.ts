import type { Venta } from "../types/venta";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function escapeHtml(value: string) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function printTicket(venta: Venta) {
  const ventana = window.open("", "_blank", "width=380,height=600");
  if (!ventana) return;

  const fecha = new Date(venta.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
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
      ? venta.pagos.map((p) => `${escapeHtml(p.metodoPago)} ${money(p.monto)}`).join(" + ")
      : escapeHtml(venta.pagos[0]?.metodoPago ?? "");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${folio}</title>
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
</style>
</head>
<body>
  <h1>Caja &amp; Inventario</h1>
  <div class="sub">Folio ${folio}<br />${fecha}</div>
  <div class="meta">Cliente: ${cliente}</div>
  <div class="meta">Método de pago: ${metodoPagoTexto}</div>
  <div class="linea"></div>
  ${filas}
  <div class="linea"></div>
  ${filaDescuento}
  <div class="fila total"><span>TOTAL</span><span>${money(venta.total)}</span></div>
  <div class="footer">¡Gracias por su compra!</div>
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
