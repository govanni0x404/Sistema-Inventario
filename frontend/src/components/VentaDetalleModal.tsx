import { Receipt, X } from "lucide-react";
import type { Venta } from "../types/venta";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function VentaDetalleModal({ venta, onClose }: { venta: Venta; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/45" onClick={onClose}>
      <div
        className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto bg-surface border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-accent-soft text-accent-dark shrink-0">
              <Receipt size={17} />
            </span>
            <div>
              <h3 className="font-display font-semibold text-lg text-ink leading-tight">Detalle de venta</h3>
              <p className="font-body text-xs text-ink-soft mt-0.5">
                {new Date(venta.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-bg text-ink-soft shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 mb-6 p-4 rounded-xl bg-bg">
          <div>
            <div className="font-body text-xs text-ink-soft mb-0.5">Cliente</div>
            <div className="font-body text-sm font-medium text-ink">{venta.cliente?.nombre || "Cliente general"}</div>
          </div>
          <div>
            <div className="font-body text-xs text-ink-soft mb-0.5">Método de pago</div>
            <div className="font-body text-sm font-medium text-ink capitalize">{venta.metodoPago}</div>
          </div>
        </div>

        <div className="mb-2 font-body text-xs font-medium text-ink-soft">Productos</div>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {venta.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <div className="font-body text-sm text-ink truncate">{it.producto?.nombre ?? it.productoId}</div>
                <div className="font-body text-xs text-ink-soft mt-0.5">
                  {it.cantidad} × {money(it.precioUnitario)}
                  {it.producto?.sku && <span className="ml-2 font-mono">{it.producto.sku}</span>}
                </div>
              </div>
              <div className="font-mono text-sm font-semibold text-ink shrink-0">{money(it.subtotal)}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
          <span className="font-display text-base font-semibold text-ink">Total</span>
          <span className="font-mono text-xl font-semibold text-accent">{money(venta.total)}</span>
        </div>
      </div>
    </div>
  );
}
