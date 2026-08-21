import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Producto } from "../types/producto";
import type { TipoMovimiento } from "../types/movimiento";
import type { Bodega } from "../types/bodega";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function MovimientoForm({
  producto,
  tipo,
  bodegas,
  fieldErrors,
  onCancel,
  onSave,
  saving,
}: {
  producto: Producto;
  tipo: TipoMovimiento;
  bodegas?: Bodega[];
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSave: (data: { cantidad: number; motivo?: string; bodegaId?: string }) => void;
  saving?: boolean;
}) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [bodegaId, setBodegaId] = useState(() => bodegas?.find((b) => b.principal)?.id ?? bodegas?.[0]?.id ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ cantidad: Number(cantidad) || 0, motivo: motivo.trim() || undefined, bodegaId: bodegaId || undefined });
  };

  const err = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-muted font-body text-xs text-muted-foreground">
        <span className="text-foreground font-medium">{producto.nombre}</span> <span className="font-mono">{producto.sku}</span>
        <div className="mt-0.5">
          Stock actual: <span className="font-mono text-foreground">{producto.stock}</span> {producto.unidad.nombre}
        </div>
      </div>

      {bodegas && bodegas.length > 1 && (
        <Field label="Bodega">
          <Select value={bodegaId} onValueChange={setBodegaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una bodega" />
            </SelectTrigger>
            <SelectContent>
              {bodegas.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label={`Cantidad a ${tipo === "entrada" ? "ingresar" : "retirar"} (${producto.unidad.nombre})`} error={err("cantidad")}>
        <Input
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          autoFocus
          required
        />
      </Field>
      <Field label="Motivo (opcional)">
        <Input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={tipo === "entrada" ? "Compra a proveedor, devolución..." : "Merma, ajuste, uso interno..."}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} variant={tipo === "entrada" ? "default" : "destructive"}>
          {saving ? "Guardando..." : tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
        </Button>
      </DialogFooter>
    </form>
  );
}
