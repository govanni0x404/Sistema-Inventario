import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ETIQUETAS_PAGO, type MetodoPago, type Venta } from "../types/venta";
import { ventasApi } from "../api/ventas";
import { cajasApi } from "../api/cajas";
import type { Caja } from "@/types/turno";
import { ApiError } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aCentavos, money } from "../lib/format";
import { printNotaCredito } from "../lib/printTicket";
import { useNegocio } from "../context/NegocioContext";

function pagadoEnCentavos(venta: Venta, it: Venta["items"][number]) {
  if (venta.esCortesia) return 0;
  const factor = venta.subtotal > 0 ? venta.total / venta.subtotal : 0;
  return aCentavos(it.importeCobrado ?? it.subtotal * factor);
}

function proporcionRedondeada(monto: number, cantidad: number, vendido: number) {
  if (vendido <= 0) return 0;
  const divisor = BigInt(vendido);
  return Number((BigInt(monto) * BigInt(cantidad) + divisor / 2n) / divisor);
}

function restantePorItem(venta: Venta) {
  const devuelto = new Map<string, number>();
  for (const d of venta.devoluciones ?? []) {
    for (const it of d.items) {
      devuelto.set(it.ventaItemId, (devuelto.get(it.ventaItemId) || 0) + it.cantidad);
    }
  }
  return venta.items.map((it) => {
    const yaDevuelto = Math.min(it.cantidad, devuelto.get(it.id) ?? 0);
    return { ...it, yaDevuelto, restante: it.cantidad - yaDevuelto };
  });
}

export default function DevolucionDialog({
  venta,
  onClose,
  onDevuelto,
}: {
  venta: Venta;
  onClose: () => void;
  onDevuelto: (venta: Venta) => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [metodoReembolso, setMetodoReembolso] = useState<MetodoPago | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [cajas, setCajas] = useState<Caja[] | "error" | null>(null);
  const [turnoElegido, setTurnoElegido] = useState("");
  const { negocio } = useNegocio();

  useEffect(() => {
    let vigente = true;
    cajasApi.listar()
      .then((items) => { if (vigente) setCajas(items); })
      .catch(() => { if (vigente) setCajas("error"); });
    return () => { vigente = false; };
  }, []);

  const cajasAbiertas = Array.isArray(cajas) ? cajas.flatMap((caja) => caja.turnoAbierto ? [{ nombre: caja.nombre, turnoId: caja.turnoAbierto.id }] : []) : [];
  const turnoCajaId = turnoElegido || (cajasAbiertas.length === 1 ? cajasAbiertas[0].turnoId : null);

  const lineas = restantePorItem(venta);
  const items = lineas.filter((it) => it.restante > 0);
  // Con pago dividido el backend exige elegir cómo se devuelve el dinero.
  const pideMetodoReembolso = !venta.esCortesia && venta.pagos.length > 1;
  const seleccion = items.map((it) => ({ ventaItemId: it.id, cantidad: Number(cantidades[it.id]) || 0 })).filter((it) => it.cantidad > 0);
  const pagadoAntes = (venta.devoluciones ?? []).reduce((suma, d) => suma + aCentavos(d.total), 0);
  const reembolsoAcumulado = lineas.reduce((suma, it) => suma + proporcionRedondeada(
    pagadoEnCentavos(venta, it), it.yaDevuelto + (Number(cantidades[it.id]) || 0), it.cantidad,
  ), 0);
  const aReembolsar = Math.max(0, reembolsoAcumulado - pagadoAntes) / 100;

  const confirmar = async () => {
    if (submitting) return;
    if (!Array.isArray(cajas) || (cajasAbiertas.length > 1 && !turnoCajaId)) {
      toast.error("Selecciona la caja en la que se registra la devolución");
      return;
    }
    if (seleccion.length === 0) {
      toast.error("Indica al menos una cantidad a devolver");
      return;
    }
    if (pideMetodoReembolso && !metodoReembolso) {
      toast.error("Indica cómo se devuelve el dinero");
      return;
    }

    setSubmitting(true);
    try {
      const devolucion = await ventasApi.devolver(venta.id, {
        motivo: motivo || null,
        turnoCajaId: turnoCajaId ?? undefined,
        metodoReembolso: pideMetodoReembolso ? (metodoReembolso as MetodoPago) : undefined,
        items: seleccion,
      });
      toast.success("Nota de crédito interna emitida", {
        description: devolucion.total > 0 ? `Reembolso de ${money(devolucion.total)}` : "Devolución sin reembolso",
        action: {
          label: "Imprimir",
          onClick: () => {
            if (!printNotaCredito(venta, devolucion, negocio)) {
              toast.error("Permite las ventanas emergentes para imprimir la nota.");
            }
          },
        },
      });
      onDevuelto({ ...venta, devoluciones: [devolucion, ...(venta.devoluciones ?? [])] });
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar la devolución");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir nota de crédito interna</DialogTitle>
          <DialogDescription>Indica cuántas unidades se devuelven. El sistema las sumará al stock y registrará el reembolso si corresponde.</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="font-body text-sm text-center py-6 text-muted-foreground">
            No queda nada por devolver en esta venta.
          </div>
        ) : (
          <div className="space-y-3">
            {cajasAbiertas.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="caja-devolucion">Caja de la devolución</Label>
                <Select value={turnoElegido} onValueChange={setTurnoElegido} disabled={submitting}>
                  <SelectTrigger id="caja-devolucion" className="w-full"><SelectValue placeholder="Selecciona una caja abierta" /></SelectTrigger>
                  <SelectContent>{cajasAbiertas.map((caja) => (
                    <SelectItem key={caja.turnoId} value={caja.turnoId}>{caja.nombre}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
            )}
            {cajas === "error" && <p role="alert" className="text-sm text-destructive">No se pudieron cargar las cajas. Cierra y vuelve a abrir la devolución.</p>}
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-body text-sm text-foreground truncate">{it.producto?.nombre ?? it.productoId}</div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">
                      Vendido: {it.cantidad} · Disponible para devolver: {it.restante}
                    </div>
                  </div>
                  <Input
                    type="number"
                    step={1}
                    min={0}
                    max={it.restante}
                    aria-label={`Cantidad a devolver de ${it.producto?.nombre ?? it.productoId}`}
                    disabled={submitting}
                    className="w-20 shrink-0"
                    placeholder="0"
                    value={cantidades[it.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = Math.max(0, Math.min(it.restante, Math.trunc(Number(val) || 0)));
                      setCantidades((c) => ({ ...c, [it.id]: val === "" ? "" : String(num) }));
                    }}
                  />
                </div>
              ))}
            </div>

            {pideMetodoReembolso && (
              <div>
                <Label className="mb-1.5 block">Devolver el dinero en</Label>
                <Select value={metodoReembolso} onValueChange={(v) => setMetodoReembolso(v as MetodoPago)}>
                  <SelectTrigger className="w-full" aria-label="Método de reembolso" disabled={submitting}>
                    <SelectValue placeholder="Elige el método de reembolso" />
                  </SelectTrigger>
                  <SelectContent>
                    {venta.pagos.map((p) => (
                      <SelectItem key={p.metodoPago} value={p.metodoPago}>
                        {ETIQUETAS_PAGO[p.metodoPago]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between font-body text-sm px-1">
              <span className="text-muted-foreground">
                {venta.esCortesia ? "Devolución de cortesía" : "Reembolso estimado"}
              </span>
              <span className="font-mono font-semibold">{money(aReembolsar)}</span>
            </div>

            <div>
              <Label htmlFor="motivo-devolucion" className="mb-1.5 block">
                Motivo (opcional)
              </Label>
              <Input
                id="motivo-devolucion"
                disabled={submitting}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. producto defectuoso"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {items.length > 0 && (
            <Button onClick={confirmar} disabled={
              submitting || !seleccion.length || !Array.isArray(cajas)
              || (cajasAbiertas.length > 1 && !turnoCajaId) || (pideMetodoReembolso && !metodoReembolso)
            }>
              {submitting ? "Guardando…" : "Confirmar y emitir nota"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
