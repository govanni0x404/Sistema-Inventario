import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, RotateCcw, Trash2 } from "lucide-react";
import { ventasEnEsperaApi } from "../api/ventasEnEspera";
import { ApiError } from "../api/client";
import type { VentaEnEspera } from "../types/ventaEnEspera";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function totalEstimado(v: VentaEnEspera) {
  const bruto = v.items.reduce((s, it) => s + it.producto.precioVenta * it.cantidad - it.descuento, 0);
  return bruto - v.descuento;
}

export default function VentasEnEsperaDialog({
  open,
  onClose,
  onRecuperar,
}: {
  open: boolean;
  onClose: () => void;
  onRecuperar: (venta: VentaEnEspera) => void;
}) {
  const [ventas, setVentas] = useState<VentaEnEspera[] | null>(null);

  const cargar = async () => {
    try {
      setVentas(await ventasEnEsperaApi.listar());
    } catch {
      toast.error("No se pudieron cargar las ventas en espera");
    }
  };

  useEffect(() => {
    if (open) {
      setVentas(null);
      cargar();
    }
  }, [open]);

  const descartar = async (v: VentaEnEspera) => {
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      setVentas((prev) => prev?.filter((x) => x.id !== v.id) ?? null);
      toast.success("Venta en espera descartada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo descartar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
              <Inbox size={17} />
            </span>
            <div>
              <DialogTitle>Ventas en espera</DialogTitle>
              <DialogDescription>Carritos enviados para retomar después.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {ventas === null && <div className="font-body text-sm text-center py-8 text-muted-foreground">Cargando…</div>}
        {ventas && ventas.length === 0 && (
          <div className="font-body text-sm text-center py-8 text-muted-foreground">No hay ventas en espera.</div>
        )}
        {ventas && ventas.length > 0 && (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden max-h-96 overflow-y-auto">
            {ventas.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-body text-sm font-medium text-foreground truncate">
                    {v.referencia || v.cliente?.nombre || "Sin referencia"}
                  </div>
                  <div className="font-body text-xs text-muted-foreground mt-0.5">
                    {v.items.length} producto(s) · {money(totalEstimado(v))} ·{" "}
                    {new Date(v.creadoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    {v.usuario && ` · ${v.usuario.nombre}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => onRecuperar(v)}>
                    <RotateCcw size={13} /> Recuperar
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => descartar(v)} aria-label="Descartar">
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
