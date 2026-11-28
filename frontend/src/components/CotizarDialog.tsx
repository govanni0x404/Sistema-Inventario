import { useState, type FormEvent } from "react";
import { cotizacionesApi, type Cotizacion, type CotizacionInput } from "@/api/cotizaciones";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hoyStr } from "@/lib/fechas";
import { money } from "@/lib/format";
import { idOperacion } from "@/lib/idOperacion";

export default function CotizarDialog({ base, cliente, total, onClose, onSave }: {
  base: Omit<CotizacionInput, "id" | "vigenteHasta" | "observaciones">;
  cliente: string;
  total: number;
  onClose: () => void;
  onSave: (cotizacion: Cotizacion) => void;
}) {
  const [id] = useState(idOperacion);
  const [fecha, setFecha] = useState(hoyStr);
  const [observaciones, setObservaciones] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      onSave(await cotizacionesApi.crear({ ...base, id, vigenteHasta: fecha, observaciones }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la cotización");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !ocupado) onClose(); }}>
      <DialogContent showCloseButton={!ocupado}>
        <DialogHeader>
          <DialogTitle>Guardar cotización</DialogTitle>
          <DialogDescription>El cliente podrá conservar el precio hasta la fecha elegida, sujeto al stock disponible al cobrar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado} className="space-y-4">
            <p className="flex flex-wrap justify-between gap-2 rounded-lg border bg-muted p-3 text-sm"><span>{cliente}</span><strong>{money(total)}</strong></p>
            <label className="grid gap-1.5 text-sm font-medium">Válida hasta
              <Input type="date" required min={hoyStr()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">Observaciones
              <Input maxLength={500} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">{ocupado ? "Guardando…" : "Guardar cotización"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
