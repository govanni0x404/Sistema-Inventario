import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Banknote } from "lucide-react";
import { movimientosCajaApi } from "../api/movimientosCaja";
import { ApiError } from "../api/client";
import type { MovimientoCaja } from "../types/turno";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function MovimientoCajaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[] | null>(null);
  const [tipo, setTipo] = useState<"retiro" | "ingreso">("retiro");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setMovimientos(await movimientosCajaApi.listarActual());
    } catch {
      toast.error("No se pudieron cargar los movimientos de caja");
    }
  };

  useEffect(() => {
    if (open) {
      setMovimientos(null);
      cargar();
    }
  }, [open]);

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo.trim() || !Number(monto)) return;
    setGuardando(true);
    try {
      await movimientosCajaApi.crear({ tipo, monto: Number(monto), motivo: motivo.trim() });
      setMonto("");
      setMotivo("");
      toast.success(tipo === "retiro" ? "Retiro registrado" : "Ingreso registrado");
      await cargar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar el movimiento");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
              <Banknote size={17} />
            </span>
            <div>
              <DialogTitle>Retiro / ingreso de caja</DialogTitle>
              <DialogDescription>Movimientos de efectivo que no vienen de una venta.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={registrar} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("retiro")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-body cursor-pointer transition-colors",
                tipo === "retiro" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground"
              )}
            >
              <ArrowUpCircle size={15} /> Retiro
            </button>
            <button
              type="button"
              onClick={() => setTipo("ingreso")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-body cursor-pointer transition-colors",
                tipo === "ingreso" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              )}
            >
              <ArrowDownCircle size={15} /> Ingreso
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Monto</Label>
            <Input value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "retiro" ? "Ej. Pago a proveedor" : "Ej. Sencillo para cambio"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={guardando || !motivo.trim() || !Number(monto)}>
            {guardando ? "Guardando..." : `Registrar ${tipo}`}
          </Button>
        </form>

        <div>
          <div className="mb-2 font-body text-xs font-medium text-muted-foreground">Movimientos del turno actual</div>
          {movimientos === null && <div className="font-body text-xs text-muted-foreground text-center py-4">Cargando…</div>}
          {movimientos && movimientos.length === 0 && (
            <div className="font-body text-xs text-muted-foreground text-center py-4">Aún no hay movimientos.</div>
          )}
          {movimientos && movimientos.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden max-h-48 overflow-y-auto">
              {movimientos.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 font-body text-xs">
                  <div className="min-w-0">
                    <div className="text-foreground truncate">{m.motivo}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {new Date(m.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      {m.usuario && ` · ${m.usuario.nombre}`}
                    </div>
                  </div>
                  <span className={cn("font-mono font-semibold shrink-0", m.tipo === "retiro" ? "text-destructive" : "text-primary")}>
                    {m.tipo === "retiro" ? "-" : "+"}
                    {money(m.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
