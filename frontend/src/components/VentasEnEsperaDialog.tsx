import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Inbox, RotateCcw, Trash2 } from "lucide-react";
import { ventasEnEsperaApi } from "../api/ventasEnEspera";
import { ApiError } from "../api/client";
import type { VentaEnEspera } from "../types/ventaEnEspera";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "./ConfirmDialog";
import { LOCALE, money } from "../lib/format";


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
  onRecuperar: (venta: VentaEnEspera) => Promise<void>;
}) {
  const [ventas, setVentas] = useState<VentaEnEspera[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [porDescartar, setPorDescartar] = useState<VentaEnEspera | null>(null);

  const [abiertoPrevio, setAbiertoPrevio] = useState(false);

  // Al abrir se limpia la lista anterior durante el render (sin setState síncrono en el efecto).
  if (open !== abiertoPrevio) {
    setAbiertoPrevio(open);
    if (open) {
      setVentas(null);
      setError(null);
    }
  }

  const cargar = async () => {
    try {
      const lista = await ventasEnEsperaApi.listar();
      setError(null);
      setVentas(lista);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  const reintentar = () => {
    setError(null);
    setVentas(null);
    void cargar();
  };

  useEffect(() => {
    if (open) cargar();
  }, [open]);

  const nombreVenta = (v: VentaEnEspera) => v.referencia || v.cliente?.nombre || "Sin referencia";

  const descartar = async (v: VentaEnEspera) => {
    setPorDescartar(null);
    setOcupado(true);
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      setVentas((prev) => prev?.filter((x) => x.id !== v.id) ?? null);
      toast.success("Venta en espera descartada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo descartar");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !ocupado && onClose()}>
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

        {error && (
          <div role="alert" className="grid place-items-center gap-2 py-8 text-center text-sm">
            <AlertCircle size={22} className="text-destructive" aria-hidden="true" />
            <p className="text-destructive">No se pudieron cargar las ventas en espera. {error}</p>
            <Button type="button" variant="outline" size="sm" onClick={reintentar}><RotateCcw size={13} /> Reintentar</Button>
          </div>
        )}
        {ventas === null && !error && <div role="status" className="font-body text-sm text-center py-8 text-muted-foreground">Cargando…</div>}
        {ventas && ventas.length === 0 && (
          <div className="font-body text-sm text-center py-8 text-muted-foreground">No hay ventas en espera.</div>
        )}
        {ventas && ventas.length > 0 && (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden max-h-96 overflow-y-auto">
            {ventas.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-body text-sm font-medium text-foreground truncate">
                    {nombreVenta(v)}
                  </div>
                  <div className="font-body text-xs text-muted-foreground mt-0.5">
                    {v.items.length} producto(s) · {money(totalEstimado(v))} ·{" "}
                    {new Date(v.creadoEn).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" })}
                    {v.usuario && ` · ${v.usuario.nombre}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" disabled={ocupado} aria-label={`Recuperar venta en espera: ${nombreVenta(v)}`} onClick={async () => {
                    setOcupado(true);
                    try {
                      await onRecuperar(v);
                    } finally {
                      setOcupado(false);
                    }
                  }}>
                    <RotateCcw size={13} /> Recuperar
                  </Button>
                  <Button variant="ghost" size="icon" disabled={ocupado} className="text-destructive hover:text-destructive" onClick={() => setPorDescartar(v)} aria-label={`Descartar venta en espera: ${nombreVenta(v)}`} title="Descartar">
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Dentro del contenido: así la confirmación queda anidada sobre esta ventana. */}
        <ConfirmDialog
          open={!!porDescartar}
          title="¿Descartar venta en espera?"
          message={porDescartar ? `Se eliminará "${nombreVenta(porDescartar)}" con ${porDescartar.items.length} producto(s). Esta acción no se puede deshacer.` : ""}
          confirmLabel="Descartar"
          onCancel={() => setPorDescartar(null)}
          onConfirm={() => { if (porDescartar) descartar(porDescartar); }}
        />
      </DialogContent>
    </Dialog>
  );
}
