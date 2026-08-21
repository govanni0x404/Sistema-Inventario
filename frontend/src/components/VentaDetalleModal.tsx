import { useState } from "react";
import { Printer, Receipt, Undo2 } from "lucide-react";
import type { Venta } from "../types/venta";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { printTicket } from "../lib/printTicket";
import DevolucionDialog from "./DevolucionDialog";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function cantidadDevuelta(venta: Venta, ventaItemId: string) {
  let total = 0;
  for (const d of venta.devoluciones ?? []) {
    for (const it of d.items) {
      if (it.ventaItemId === ventaItemId) total += it.cantidad;
    }
  }
  return total;
}

export default function VentaDetalleModal({
  venta,
  onClose,
  onCambio,
}: {
  venta: Venta | null;
  onClose: () => void;
  onCambio?: (venta: Venta) => void;
}) {
  const [devolviendo, setDevolviendo] = useState(false);
  const hayDevoluciones = (venta?.devoluciones?.length ?? 0) > 0;
  const quedaAlgoPorDevolver = venta
    ? venta.items.some((it) => it.cantidad - cantidadDevuelta(venta, it.id) > 0)
    : false;

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
                {venta.esCortesia && (
                  <Badge variant="warning" className="shrink-0">
                    Cortesía
                  </Badge>
                )}
                {hayDevoluciones && (
                  <Badge variant="destructive" className="shrink-0">
                    Devuelta
                  </Badge>
                )}
                {quedaAlgoPorDevolver && (
                  <Button variant="outline" size="sm" onClick={() => setDevolviendo(true)} className="shrink-0">
                    <Undo2 size={14} /> Devolver
                  </Button>
                )}
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
                <div className="font-body text-xs text-muted-foreground mb-0.5">
                  {venta.esCortesia ? "Motivo" : venta.pagos.length > 1 ? "Formas de pago" : "Método de pago"}
                </div>
                {venta.esCortesia ? (
                  <div className="font-body text-sm font-medium text-foreground">{venta.motivoCortesia}</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {venta.pagos.map((p) => (
                      <Badge key={p.id} variant="secondary" className="capitalize">
                        {p.metodoPago}
                        {venta.pagos.length > 1 && <span className="ml-1 font-mono">{money(p.monto)}</span>}
                      </Badge>
                    ))}
                  </div>
                )}
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
                {venta.items.map((it) => {
                  const devuelto = cantidadDevuelta(venta, it.id);
                  return (
                    <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div className="min-w-0">
                        <div className="font-body text-sm text-foreground truncate">{it.producto?.nombre ?? it.productoId}</div>
                        <div className="font-body text-xs text-muted-foreground mt-0.5">
                          {it.cantidad} × {money(it.precioUnitario)}
                          {it.producto?.sku && <span className="ml-2 font-mono">{it.producto.sku}</span>}
                          {it.descuento > 0 && <span className="ml-2 text-emerald-600">-{money(it.descuento)} desc.</span>}
                          {devuelto > 0 && (
                            <span className="ml-2 text-destructive">· {devuelto} devuelta{devuelto > 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="font-mono text-sm font-semibold text-foreground shrink-0">{money(it.subtotal)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-1.5">
              {venta.descuento > 0 && (
                <>
                  <div className="flex items-center justify-between font-body text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">{money(venta.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between font-body text-sm text-emerald-600">
                    <span>Descuento</span>
                    <span className="font-mono">-{money(venta.descuento)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-foreground">Total</span>
                <span className="font-mono text-xl font-semibold text-primary">{money(venta.total)}</span>
              </div>
            </div>

            {hayDevoluciones && (
              <div>
                <div className="mb-2 font-body text-xs font-medium text-muted-foreground">Devoluciones</div>
                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {venta.devoluciones!.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="font-body text-sm text-foreground">
                          {new Date(d.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                        <div className="font-body text-xs text-muted-foreground mt-0.5">
                          {d.motivo || "Sin motivo"}
                          {d.usuario?.nombre && <span> · {d.usuario.nombre}</span>}
                        </div>
                      </div>
                      <div className="font-mono text-sm font-semibold text-destructive shrink-0">-{money(d.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>

      <DevolucionDialog
        venta={devolviendo ? venta : null}
        onClose={() => setDevolviendo(false)}
        onDevuelto={(actualizada) => onCambio?.(actualizada)}
      />
    </Dialog>
  );
}
