import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MetodoPago, Venta } from "../types/venta";
import { ventasApi } from "../api/ventas";
import { ApiError } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "../lib/format";

const round2 = (n: number) => Math.round(n * 100) / 100;
const METODO_LABEL: Record<MetodoPago, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Lo realmente cobrado por unidad (igual que el backend): subtotal del ítem ya con su
// descuento, prorrateado por el descuento del ticket. Una cortesía no se reembolsa.
function pagadoPorUnidad(venta: Venta, it: Venta["items"][number]) {
  if (venta.esCortesia || it.cantidad <= 0) return 0;
  const factor = venta.subtotal > 0 ? venta.total / venta.subtotal : 0;
  return (it.subtotal / it.cantidad) * factor;
}

function restantePorItem(venta: Venta) {
  const devuelto = new Map<string, number>();
  for (const d of venta.devoluciones ?? []) {
    for (const it of d.items) {
      devuelto.set(it.ventaItemId, (devuelto.get(it.ventaItemId) || 0) + it.cantidad);
    }
  }
  return venta.items.map((it) => ({
    ...it,
    restante: it.cantidad - (devuelto.get(it.id) || 0),
  }));
}

export default function DevolucionDialog({
  venta,
  onClose,
  onDevuelto,
}: {
  venta: Venta | null;
  onClose: () => void;
  onDevuelto: (venta: Venta) => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [metodoReembolso, setMetodoReembolso] = useState<MetodoPago | "">("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCantidades({});
    setMotivo("");
    setMetodoReembolso("");
  }, [venta?.id]);

  if (!venta) return null;

  const items = restantePorItem(venta).filter((it) => it.restante > 0);
  // Con pago dividido el backend exige elegir cómo se devuelve el dinero.
  const pideMetodoReembolso = !venta.esCortesia && venta.pagos.length > 1;
  const aReembolsar = round2(
    items.reduce((s, it) => s + round2(pagadoPorUnidad(venta, it) * (Number(cantidades[it.id]) || 0)), 0)
  );

  const confirmar = async () => {
    const itemsData = Object.entries(cantidades)
      .map(([ventaItemId, v]) => ({ ventaItemId, cantidad: Number(v) }))
      .filter((it) => it.cantidad > 0);

    if (itemsData.length === 0) {
      toast.error("Indica al menos una cantidad a devolver");
      return;
    }
    if (pideMetodoReembolso && !metodoReembolso) {
      toast.error("Indica cómo se devuelve el dinero");
      return;
    }

    setSubmitting(true);
    try {
      await ventasApi.devolver(venta.id, {
        motivo: motivo || null,
        metodoReembolso: pideMetodoReembolso ? (metodoReembolso as MetodoPago) : undefined,
        items: itemsData,
      });
      const actualizada = await ventasApi.obtener(venta.id);
      toast.success("Devolución registrada");
      onDevuelto(actualizada);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar la devolución");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!venta} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Devolver productos</DialogTitle>
          <DialogDescription>Indica la cantidad a devolver de cada producto. Se restaurará el stock.</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="font-body text-sm text-center py-6 text-muted-foreground">
            No queda nada por devolver en esta venta.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-body text-sm text-foreground truncate">{it.producto?.nombre ?? it.productoId}</div>
                    <div className="font-body text-xs text-muted-foreground mt-0.5">
                      Vendido: {it.cantidad} · Disponible para devolver: {it.restante} · {money(pagadoPorUnidad(venta, it))} c/u pagado
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={it.restante}
                    className="w-20 shrink-0"
                    placeholder="0"
                    value={cantidades[it.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = Math.max(0, Math.min(it.restante, Number(val) || 0));
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige el método de reembolso" />
                  </SelectTrigger>
                  <SelectContent>
                    {venta.pagos.map((p) => (
                      <SelectItem key={p.metodoPago} value={p.metodoPago}>
                        {METODO_LABEL[p.metodoPago]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between font-body text-sm px-1">
              <span className="text-muted-foreground">
                {venta.esCortesia ? "Cortesía: no se reembolsa dinero" : "A reembolsar"}
              </span>
              <span className="font-mono font-semibold">{money(aReembolsar)}</span>
            </div>

            <div>
              <Label htmlFor="motivo-devolucion" className="mb-1.5 block">
                Motivo (opcional)
              </Label>
              <Input
                id="motivo-devolucion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. producto defectuoso"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {items.length > 0 && (
            <Button onClick={confirmar} disabled={submitting}>
              {submitting ? "Guardando..." : "Confirmar devolución"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
