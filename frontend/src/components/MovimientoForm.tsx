import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Producto } from "../types/producto";
import type { TipoMovimiento } from "../types/movimiento";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

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
  fieldErrors,
  onCancel,
  onSave,
  saving,
}: {
  producto: Producto;
  tipo: TipoMovimiento;
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSave: (data: { cantidad: number; motivo?: string }) => void;
  saving?: boolean;
}) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ cantidad: Number(cantidad) || 0, motivo: motivo.trim() || undefined });
  };

  const err = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-muted font-body text-xs text-muted-foreground">
        <span className="text-foreground font-medium">{producto.nombre}</span> <span className="font-mono">{producto.sku}</span>
        <div className="mt-0.5">
          Stock actual: <span className="font-mono text-foreground">{producto.stock}</span> {producto.unidad}
        </div>
      </div>

      <Field label={`Cantidad a ${tipo === "entrada" ? "ingresar" : "retirar"} (${producto.unidad})`} error={err("cantidad")}>
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
