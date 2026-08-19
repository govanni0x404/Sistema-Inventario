import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { tiposTurnoApi } from "../api/tiposTurno";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import type { TipoTurno, TurnoCaja } from "../types/turno";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AbrirTurnoCard({ onAbierto }: { onAbierto: (turno: TurnoCaja) => void }) {
  const [tipos, setTipos] = useState<TipoTurno[]>([]);
  const [tipoTurnoId, setTipoTurnoId] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  useEffect(() => {
    tiposTurnoApi
      .listar(true)
      .then(setTipos)
      .catch(() => toast.error("No se pudieron cargar los tipos de turno"));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipoTurnoId) {
      toast.error("Selecciona un tipo de turno");
      return;
    }
    setAbriendo(true);
    try {
      const turno = await turnosApi.abrir({ tipoTurnoId, montoInicial: Number(montoInicial) || 0 });
      toast.success("Turno abierto");
      onAbierto(turno);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el turno");
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
              <Lock size={18} />
            </span>
            <div>
              <CardTitle className="font-display text-base">Abrir turno de caja</CardTitle>
              <CardDescription>Necesitas abrir un turno antes de vender</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de turno</Label>
              <Select value={tipoTurnoId} onValueChange={setTipoTurnoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un turno" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay tipos de turno configurados. Pídele a un administrador que cree uno en Turnos.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fondo inicial en caja</Label>
              <Input
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={abriendo || tipos.length === 0} className="w-full">
              {abriendo ? "Abriendo..." : "Abrir turno"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
