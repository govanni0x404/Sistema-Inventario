import { estadosCompra, type OrdenCompra } from "@/api/compras";
import { fechaCompleta } from "./fechas";
import { centavosCosto, costoEnPesos } from "./formatCosto";
import { escapeHtml } from "./printTicket";
import type { Negocio } from "@/types/negocio";

export function printCompra(orden: OrdenCompra, negocio: Negocio) {
  const ventana = window.open("", "_blank", "width=850,height=700");
  if (!ventana) return false;
  ventana.opener = null;
  const total = orden.items.reduce((acum, item) => acum + centavosCosto(item.costoUnitario, item.cantidad), 0n);
  const filas = orden.items.map((item) => `<tr>
    <td>${escapeHtml(item.sku)}</td><td>${escapeHtml(item.productoNombre)}</td><td>${item.cantidad}</td>
    <td>${costoEnPesos(centavosCosto(item.costoUnitario))}</td>
    <td>${costoEnPesos(centavosCosto(item.costoUnitario, item.cantidad))}</td>
  </tr>`).join("");
  const datosNegocio = [negocio.rut, negocio.direccion, negocio.email, negocio.telefono].filter(Boolean).join(" · ");
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>OC #${orden.folio}</title>
    <style>
      @page { size: A4; margin: 17mm; }
      body { font: 14px system-ui, sans-serif; color: #182028; margin: 24px; }
      h1 { font-size: 27px; margin-bottom: 4px; }
      header { border-bottom: 2px solid #182028; padding-bottom: 16px; }
      table { width: 100%; margin-top: 20px; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #aab4bd; padding: 8px; text-align: left; overflow-wrap: anywhere; }
      th:nth-child(n+3), td:nth-child(n+3) { text-align: right; }
      tr { break-inside: avoid; }
      p { overflow-wrap: anywhere; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <header><strong>${escapeHtml(negocio.nombre)}</strong><div>${escapeHtml(datosNegocio)}</div>
    <h1>Orden de compra #${orden.folio}</h1><div>${estadosCompra[orden.estado]}</div></header>
    <p><strong>Proveedor</strong> · ${escapeHtml(orden.proveedorNombre)}</p>
    <p><strong>Bodega de destino</strong> · ${escapeHtml(orden.bodegaNombre)}</p>
    ${orden.entregaEstimada ? `<p><strong>Entrega estimada</strong> · ${fechaCompleta(orden.entregaEstimada.slice(0, 10))}</p>` : ""}
    ${orden.nota ? `<p><strong>Observaciones</strong> · ${escapeHtml(orden.nota)}</p>` : ""}
    ${orden.motivoCierre ? `<p><strong>Motivo de cierre</strong> · ${escapeHtml(orden.motivoCierre)}</p>` : ""}
    <table><thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Importe</th></tr></thead>
    <tbody>${filas}</tbody><tfoot><tr><td colspan="4"><strong>Importe de la orden</strong></td><td><strong>${costoEnPesos(total)}</strong></td></tr></tfoot>
    </table></body></html>`);
  ventana.document.close();
  ventana.focus();
  ventana.print();
  return true;
}
