import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import type { TurnoCaja } from "../types/turno";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function CerrarTurnoDialog({
  turno,
  onClose,
  onCerrado,
}: {
  turno: TurnoCaja;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const [detalle, setDetalle] = useState<TurnoCaja | null>(null);
  const [montoContado, setMontoContado] = useState("");
  const [notas, setNotas] = useState("");
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    turnosApi
      .obtener(turno.id)
      .then(setDetalle)
      .catch(() => toast.error("No se pudo cargar el resumen del turno"));
  }, [turno.id]);

  const efectivo = detalle?.resumenVentas?.porMetodo.efectivo ?? 0;
  const ingresos = detalle?.movimientosCaja?.ingresos ?? 0;
  const retiros = detalle?.movimientosCaja?.retiros ?? 0;
  const esperado = turno.montoInicial + efectivo + ingresos - retiros;
  const diferencia = montoContado ? Number(montoContado) - esperado : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCerrando(true);
    try {
      await turnosApi.cerrar(turno.id, { montoContado: Number(montoContado) || 0, notas: notas.trim() || undefined });
      toast.success("Turno cerrado");
      onCerrado();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cerrar el turno");
    } finally {
      setCerrando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar turno — {turno.tipoTurno.nombre}</DialogTitle>
          <DialogDescription>Cuenta el efectivo físico en caja y regístralo para hacer el arqueo.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-3 font-body text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fondo inicial</span>
            <span className="font-mono text-foreground">{money(turno.montoInicial)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ventas en efectivo</span>
            <span className="font-mono text-foreground">{detalle ? money(efectivo) : "…"}</span>
          </div>
          {ingresos > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingresos de caja</span>
              <span className="font-mono text-primary">+{money(ingresos)}</span>
            </div>
          )}
          {retiros > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retiros de caja</span>
              <span className="font-mono text-destructive">-{money(retiros)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium pt-1.5 border-t border-border">
            <span>Esperado en caja</span>
            <span className="font-mono">{detalle ? money(esperado) : "…"}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Efectivo contado</Label>
            <Input
              value={montoContado}
              onChange={(e) => setMontoContado(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
              required
            />
          </div>

          {diferencia !== null && (
            <div className="flex justify-between font-body text-sm px-1">
              <span className="text-muted-foreground">Diferencia</span>
              <span className={`font-mono font-semibold ${diferencia < 0 ? "text-destructive" : diferencia > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {diferencia > 0 ? "+" : ""}
                {money(diferencia)}
                {diferencia < 0 ? " (faltante)" : diferencia > 0 ? " (sobrante)" : ""}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones del corte..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={cerrando}>
              {cerrando ? "Cerrando..." : "Cerrar turno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
