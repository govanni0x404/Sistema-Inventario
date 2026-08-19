import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Producto } from "../types/producto";
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

export default function PrecioForm({
  producto,
  fieldErrors,
  onCancel,
  onSave,
  saving,
}: {
  producto: Producto;
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSave: (data: { precioCompra: number; precioVenta: number }) => void;
  saving?: boolean;
}) {
  const [precioCompra, setPrecioCompra] = useState(String(producto.precioCompra));
  const [precioVenta, setPrecioVenta] = useState(String(producto.precioVenta));

  const setNumber = (setter: (v: string) => void, value: string) => setter(value.replace(/[^0-9.]/g, ""));

  const margen = Number(precioVenta) - Number(precioCompra);
  const margenPct = Number(precioCompra) > 0 ? (margen / Number(precioCompra)) * 100 : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ precioCompra: Number(precioCompra) || 0, precioVenta: Number(precioVenta) || 0 });
  };

  const err = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-lg bg-muted font-body text-xs text-muted-foreground">
        <span className="text-foreground font-medium">{producto.nombre}</span> <span className="font-mono">{producto.sku}</span>
      </div>

      <Field label="Precio de compra" error={err("precioCompra")}>
        <Input value={precioCompra} onChange={(e) => setNumber(setPrecioCompra, e.target.value)} inputMode="decimal" required />
      </Field>
      <Field label="Precio de venta" error={err("precioVenta")}>
        <Input value={precioVenta} onChange={(e) => setNumber(setPrecioVenta, e.target.value)} inputMode="decimal" required />
      </Field>

      <div className="flex justify-between font-body text-xs text-muted-foreground px-1">
        <span>Margen</span>
        <span className={`font-mono font-medium ${margen < 0 ? "text-destructive" : "text-primary"}`}>
          ${margen.toFixed(2)}
          {margenPct !== null && ` (${margenPct.toFixed(0)}%)`}
        </span>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
