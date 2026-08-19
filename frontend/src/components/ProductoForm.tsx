import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Producto, ProductoInput } from "../types/producto";
import type { Proveedor } from "../types/proveedor";
import { proveedoresApi } from "../api/proveedores";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type FormState = {
  sku: string;
  nombre: string;
  categoria: string;
  precioVenta: string;
  stockMinimo: string;
  unidad: string;
  proveedorId: string;
};

function toFormState(p?: Producto): FormState {
  return {
    sku: p?.sku ?? "",
    nombre: p?.nombre ?? "",
    categoria: p?.categoria ?? "",
    precioVenta: p ? String(p.precioVenta) : "",
    stockMinimo: p ? String(p.stockMinimo) : "0",
    unidad: p?.unidad ?? "pieza",
    proveedorId: p?.proveedorId ?? "",
  };
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const SIN_PROVEEDOR = "__none__";

export default function ProductoForm({
  initial,
  fieldErrors,
  onCancel,
  onSave,
  saving,
}: {
  initial?: Producto;
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSave: (data: ProductoInput) => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<FormState>(toFormState(initial));
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => {
    proveedoresApi.listar().then(setProveedores).catch(() => setProveedores([]));
  }, []);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setNumber = (key: keyof FormState, value: string) => set(key, value.replace(/[^0-9.]/g, ""));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      sku: form.sku.trim(),
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || undefined,
      precioVenta: Number(form.precioVenta) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
      unidad: form.unidad.trim() || "unidad",
      proveedorId: form.proveedorId || null,
    });
  };

  const err = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial && (
        <div className="flex gap-4 p-3 rounded-lg bg-muted font-body text-xs text-muted-foreground">
          <span>
            Stock: <span className="font-mono text-foreground">{initial.stock}</span> {initial.unidad}
          </span>
          <span>
            Precio de compra: <span className="font-mono text-foreground">{money(initial.precioCompra)}</span>
          </span>
          <span className="ml-auto italic">Se gestionan en Bodega / Precios</span>
        </div>
      )}

      <Field label="SKU" error={err("sku")}>
        <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
      </Field>
      <Field label="Nombre" error={err("nombre")}>
        <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
      </Field>
      <Field label="Categoría">
        <Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} />
      </Field>
      <Field label="Precio de venta" error={err("precioVenta")}>
        <Input value={form.precioVenta} onChange={(e) => setNumber("precioVenta", e.target.value)} inputMode="decimal" required />
      </Field>
      <Field label="Stock mínimo" error={err("stockMinimo")}>
        <Input value={form.stockMinimo} onChange={(e) => setNumber("stockMinimo", e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Unidad">
        <Input value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="pieza, kg, caja..." />
      </Field>
      <Field label="Proveedor">
        <Select
          value={form.proveedorId || SIN_PROVEEDOR}
          onValueChange={(v) => set("proveedorId", v === SIN_PROVEEDOR ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— Sin asignar —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_PROVEEDOR}>— Sin asignar —</SelectItem>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

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
