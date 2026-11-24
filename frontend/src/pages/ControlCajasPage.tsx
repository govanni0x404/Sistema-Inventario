import { useEffect, useState, type FormEvent } from "react";
import { Banknote, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { cajasApi } from "@/api/cajas";
import { ApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Caja } from "@/types/turno";

function CajaForm({ caja, onClose, onSaved }: { caja: Caja | null; onClose: () => void; onSaved: (caja: Caja) => void }) {
  const [nombre, setNombre] = useState(caja?.nombre ?? "");
  const [activa, setActiva] = useState(caja?.activa ?? true);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (event: FormEvent) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      const actualizada = await cajasApi.guardar({ nombre: nombre.trim(), activa }, caja?.id);
      onSaved(actualizada);
      toast.success(caja ? "Caja actualizada" : "Caja creada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar la caja");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !guardando) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{caja ? "Editar caja" : "Nueva caja"}</DialogTitle>
          <DialogDescription>Define el nombre de la caja y su disponibilidad.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="control-caja-nombre">Nombre</Label>
            <Input id="control-caja-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="control-caja-activa">Disponible para operar</Label>
            <Switch id="control-caja-activa" checked={activa} onCheckedChange={setActiva} disabled={Boolean(caja?.principal || caja?.turnoAbierto)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={guardando || !nombre.trim()}>{guardando ? "Guardando…" : "Guardar caja"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ControlCajasPage() {
  const [cajas, setCajas] = useState<Caja[] | "error" | null>(null);
  const [edicion, setEdicion] = useState<Caja | null | undefined>(undefined);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    cajasApi.listar(true)
      .then((items) => { if (vigente) setCajas(items); })
      .catch(() => { if (vigente) setCajas("error"); });
    return () => { vigente = false; };
  }, [intento]);

  return (
    <section aria-label="Cajas del negocio" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Administra las cajas del negocio y revisa cuáles tienen un turno abierto.</p>
        <Button onClick={() => setEdicion(null)}><Plus size={16} /> Nueva caja</Button>
      </div>
      {cajas === null && <p role="status" className="text-sm text-muted-foreground">Cargando cajas…</p>}
      {cajas === "error" && (
        <p role="alert" className="text-sm text-destructive">No se pudieron cargar las cajas. <button type="button" className="underline" onClick={() => setIntento((n) => n + 1)}>Reintentar</button></p>
      )}
      {Array.isArray(cajas) && (
        <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {cajas.map((caja) => (
            <li key={caja.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-background/60 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Banknote size={19} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-semibold [overflow-wrap:anywhere]">{caja.nombre}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {caja.principal && <Badge variant="outline">Principal</Badge>}
                    <Badge variant={caja.turnoAbierto ? "default" : "secondary"}>{caja.turnoAbierto ? "Turno abierto" : caja.activa ? "Disponible" : "Inactiva"}</Badge>
                  </div>
                </div>
                <Button size="icon" variant="outline" aria-label={`Editar ${caja.nombre}`} onClick={() => setEdicion(caja)}><Pencil size={15} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edicion !== undefined && (
        <CajaForm caja={edicion} onClose={() => setEdicion(undefined)} onSaved={(caja) => {
          setEdicion(undefined);
          setCajas((previas) => Array.isArray(previas)
            ? [...previas.filter((item) => item.id !== caja.id), caja].sort((a, b) => Number(b.principal) - Number(a.principal) || a.nombre.localeCompare(b.nombre, "es"))
            : previas);
          setIntento((n) => n + 1);
        }} />
      )}
    </section>
  );
}
