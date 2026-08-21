import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Venta } from "../types/venta";
import { ventasApi } from "../api/ventas";
import { ApiError } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCantidades({});
    setMotivo("");
  }, [venta?.id]);

  if (!venta) return null;

  const items = restantePorItem(venta).filter((it) => it.restante > 0);

  const confirmar = async () => {
    const itemsData = Object.entries(cantidades)
      .map(([ventaItemId, v]) => ({ ventaItemId, cantidad: Number(v) }))
      .filter((it) => it.cantidad > 0);

    if (itemsData.length === 0) {
      toast.error("Indica al menos una cantidad a devolver");
      return;
    }

    setSubmitting(true);
    try {
      await ventasApi.devolver(venta.id, { motivo: motivo || null, items: itemsData });
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
                      Vendido: {it.cantidad} · Disponible para devolver: {it.restante} · {money(it.precioUnitario)} c/u
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
