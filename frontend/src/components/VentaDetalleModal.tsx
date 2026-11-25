import { useEffect, useState } from "react";
import { Printer, Receipt, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Venta } from "../types/venta";
import { ventasApi } from "../api/ventas";
import { ApiError } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { folioComprobante, folioNotaCredito, printNotaCredito, printTicket } from "../lib/printTicket";
import { useNegocio } from "../context/NegocioContext";
import DevolucionDialog from "./DevolucionDialog";
import { LOCALE, money } from "../lib/format";


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
  venta: Pick<Venta, "id"> | null;
  onClose: () => void;
  onCambio?: (venta: Venta) => void;
}) {
  if (!venta) return null;
  return <DetalleVenta key={venta.id} ventaId={venta.id} onClose={onClose} onCambio={onCambio} />;
}

function DetalleVenta({
  ventaId,
  onClose,
  onCambio,
}: {
  ventaId: string;
  onClose: () => void;
  onCambio?: (venta: Venta) => void;
}) {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [errorDetalle, setErrorDetalle] = useState("");
  const [reintento, setReintento] = useState(0);
  const [ventaDevolucion, setVentaDevolucion] = useState<Venta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const { negocio } = useNegocio();
  const devoluciones = venta?.devoluciones ?? [];
  const hayDevoluciones = devoluciones.length > 0;
  const quedaAlgoPorDevolver = venta
    ? venta.items.some((it) => it.cantidad - cantidadDevuelta(venta, it.id) > 0)
    : false;

  useEffect(() => {
    let vigente = true;
    ventasApi.obtener(ventaId).then((detalle) => {
      if (vigente) setVenta(detalle);
    }).catch((error) => {
      if (vigente) setErrorDetalle(error instanceof ApiError ? error.message : "No se pudo cargar el detalle de venta.");
    });
    return () => { vigente = false; };
  }, [ventaId, reintento]);

  const iniciarDevolucion = async () => {
    if (!venta || cargandoDetalle) return;
    setCargandoDetalle(true);
    try {
      const detalle = await ventasApi.obtener(venta.id);
      setVenta(detalle);
      setVentaDevolucion(detalle);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cargar el detalle para la devolución.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !cargandoDetalle && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {!venta && (
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
            <DialogDescription>{errorDetalle || "Cargando el comprobante y sus notas de crédito…"}</DialogDescription>
            {errorDetalle && (
              <Button variant="outline" className="w-fit" onClick={() => {
                setErrorDetalle("");
                setReintento((intento) => intento + 1);
              }}>Reintentar</Button>
            )}
          </DialogHeader>
        )}
        {venta && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-3 pr-8">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                  <Receipt size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Comprobante {folioComprobante(venta.id)}</DialogTitle>
                  <DialogDescription>
                    {new Date(venta.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                  </DialogDescription>
                </div>
                {venta.esCortesia && (
                  <Badge variant="warning" className="shrink-0">
                    Cortesía
                  </Badge>
                )}
                {hayDevoluciones && (
                  <Badge variant="destructive" className="shrink-0">
                    {quedaAlgoPorDevolver ? "Devolución parcial" : "Devuelta"}
                  </Badge>
                )}
                {quedaAlgoPorDevolver && (
                  <Button variant="outline" size="sm" onClick={iniciarDevolucion} disabled={cargandoDetalle} className="shrink-0">
                    <Undo2 size={14} /> {cargandoDetalle ? "Cargando…" : "Emitir nota de crédito"}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => {
                  if (!printTicket(venta, negocio)) toast.error("Permite las ventanas emergentes para reimprimir el comprobante.");
                }}>
                  <Printer size={14} /> Reimprimir
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
                        <span className="ml-1 font-mono">{money(p.monto)}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {venta.turnoCaja && (
                <div>
                  <div className="font-body text-xs text-muted-foreground mb-0.5">Turno</div>
                  <div className="font-body text-sm font-medium text-foreground">{venta.turnoCaja.caja.nombre} · {venta.turnoCaja.tipoTurno.nombre}</div>
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
                          {it.producto?.codigoBarras && <span className="ml-2 font-mono">{it.producto.codigoBarras}</span>}
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
              {venta.esCortesia && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Valor de referencia</span><span className="font-mono">{money(venta.total)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-foreground">Total cobrado</span>
                <span className="font-mono text-xl font-semibold text-primary">{money(venta.esCortesia ? 0 : venta.total)}</span>
              </div>
            </div>

            {hayDevoluciones && (
              <div>
                <h3 className="mb-2 font-body text-sm font-semibold text-foreground">Notas de crédito internas</h3>
                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {devoluciones.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="font-mono text-xs font-semibold text-foreground [overflow-wrap:anywhere]">{folioNotaCredito(d.id)}</p>
                        <div className="mt-1 font-body text-xs text-muted-foreground">
                          {new Date(d.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                          {d.usuario?.nombre && <span> · {d.usuario.nombre}</span>}
                        </div>
                        {d.motivo && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{d.motivo}</p>}
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-sm font-semibold">{money(d.total)}</div>
                          <div className="text-xs capitalize text-muted-foreground">{d.total === 0 ? "Sin reembolso" : d.metodoReembolso ?? "Reembolso"}</div>
                        </div>
                        <Button variant="outline" size="sm" aria-label={`Imprimir nota ${folioNotaCredito(d.id)}`} onClick={() => {
                          if (!printNotaCredito(venta, d, negocio)) toast.error("Permite las ventanas emergentes para imprimir la nota.");
                        }}>
                          <Printer size={14} /> Imprimir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>

      {ventaDevolucion && (
        <DevolucionDialog
          venta={ventaDevolucion}
          onClose={() => setVentaDevolucion(null)}
          onDevuelto={(actualizada) => {
            setVenta(actualizada);
            onCambio?.(actualizada);
          }}
        />
      )}
    </Dialog>
  );
}
