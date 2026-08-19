import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { tiposTurnoApi } from "../api/tiposTurno";
import { ApiError } from "../api/client";
import type { TipoTurno } from "../types/turno";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function TipoTurnoManager({ onChange }: { onChange?: () => void }) {
  const [tipos, setTipos] = useState<TipoTurno[]>([]);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    try {
      setTipos(await tiposTurnoApi.listar());
    } catch {
      toast.error("No se pudieron cargar los tipos de turno");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const nuevo = await tiposTurnoApi.crear({ nombre: nombre.trim() });
      setTipos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear el tipo de turno");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (tipo: TipoTurno) => {
    try {
      const actualizado = await tiposTurnoApi.actualizar(tipo.id, { activo: !tipo.activo });
      setTipos((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)));
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar");
    }
  };

  const eliminar = async (tipo: TipoTurno) => {
    try {
      const resultado = await tiposTurnoApi.eliminar(tipo.id);
      if (resultado?._desactivado) {
        setTipos((prev) => prev.map((t) => (t.id === resultado.id ? resultado : t)));
        toast("Tenía turnos asociados: se desactivó en lugar de eliminarse");
      } else {
        setTipos((prev) => prev.filter((t) => t.id !== tipo.id));
        toast.success("Tipo de turno eliminado");
      }
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Tipos de turno</CardTitle>
        <CardDescription>Ej. Turno Mañana, Turno Tarde — se eligen al abrir un turno de caja.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {tipos.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="font-body text-sm text-foreground">{t.nombre}</span>
              <div className="flex items-center gap-3">
                <Switch checked={t.activo} onCheckedChange={() => toggleActivo(t)} />
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(t)} aria-label="Eliminar">
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
          {tipos.length === 0 && <div className="font-body text-xs text-muted-foreground">Aún no hay tipos de turno.</div>}
        </div>

        <form onSubmit={crear} className="flex gap-2">
          <Input placeholder="Nombre del turno (ej. Turno Noche)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Button type="submit" disabled={creando}>
            <Plus size={16} /> Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
