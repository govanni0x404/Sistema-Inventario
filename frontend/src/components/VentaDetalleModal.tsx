import { Printer, Receipt } from "lucide-react";
import type { Venta } from "../types/venta";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { printTicket } from "../lib/printTicket";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function VentaDetalleModal({ venta, onClose }: { venta: Venta | null; onClose: () => void }) {
  return (
    <Dialog open={!!venta} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {venta && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 pr-8">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                  <Receipt size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Detalle de venta</DialogTitle>
                  <DialogDescription>
                    {new Date(venta.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </DialogDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => printTicket(venta)} className="shrink-0">
                  <Printer size={14} /> Imprimir
                </Button>
              </div>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-8 gap-y-3 p-4 rounded-xl bg-muted">
              <div>
                <div className="font-body text-xs text-muted-foreground mb-0.5">Cliente</div>
                <div className="font-body text-sm font-medium text-foreground">{venta.cliente?.nombre || "Cliente general"}</div>
              </div>
              <div>
                <div className="font-body text-xs text-muted-foreground mb-0.5">Método de pago</div>
                <Badge variant="secondary" className="capitalize">
                  {venta.metodoPago}
                </Badge>
              </div>
              {venta.turnoCaja && (
                <div>
                  <div className="font-body text-xs text-muted-foreground mb-0.5">Turno</div>
                  <div className="font-body text-sm font-medium text-foreground">{venta.turnoCaja.tipoTurno.nombre}</div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 font-body text-xs font-medium text-muted-foreground">Productos</div>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {venta.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <div className="font-body text-sm text-foreground truncate">{it.producto?.nombre ?? it.productoId}</div>
                      <div className="font-body text-xs text-muted-foreground mt-0.5">
                        {it.cantidad} × {money(it.precioUnitario)}
                        {it.producto?.sku && <span className="ml-2 font-mono">{it.producto.sku}</span>}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground shrink-0">{money(it.subtotal)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="font-display text-base font-semibold text-foreground">Total</span>
              <span className="font-mono text-xl font-semibold text-primary">{money(venta.total)}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
