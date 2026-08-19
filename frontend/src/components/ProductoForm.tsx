import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Producto, ProductoInput } from "../types/producto";
import type { Proveedor } from "../types/proveedor";
import { proveedoresApi } from "../api/proveedores";

const inputCls =
  "w-full font-body text-sm px-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors";

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block font-body text-xs font-medium mb-1 text-ink-soft">{label}</span>
      {children}
      {error && <span className="block font-body text-xs mt-1 text-warn">{error}</span>}
    </label>
  );
}

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
    <form onSubmit={handleSubmit}>
      {initial && (
        <div className="flex gap-4 mb-4 p-3 rounded-lg bg-bg font-body text-xs text-ink-soft">
          <span>
            Stock: <span className="font-mono text-ink">{initial.stock}</span> {initial.unidad}
          </span>
          <span>
            Precio de compra: <span className="font-mono text-ink">{money(initial.precioCompra)}</span>
          </span>
          <span className="ml-auto text-ink-soft/70 italic">Se gestionan en Bodega / Precios</span>
        </div>
      )}

      <Field label="SKU" error={err("sku")}>
        <input className={inputCls} value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
      </Field>
      <Field label="Nombre" error={err("nombre")}>
        <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
      </Field>
      <Field label="Categoría">
        <input className={inputCls} value={form.categoria} onChange={(e) => set("categoria", e.target.value)} />
      </Field>
      <Field label="Precio de venta" error={err("precioVenta")}>
        <input className={inputCls} value={form.precioVenta} onChange={(e) => setNumber("precioVenta", e.target.value)} inputMode="decimal" required />
      </Field>
      <Field label="Stock mínimo" error={err("stockMinimo")}>
        <input className={inputCls} value={form.stockMinimo} onChange={(e) => setNumber("stockMinimo", e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Unidad">
        <input className={inputCls} value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="pieza, kg, caja..." />
      </Field>
      <Field label="Proveedor">
        <select className={inputCls} value={form.proveedorId} onChange={(e) => set("proveedorId", e.target.value)}>
          <option value="">— Sin asignar —</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onCancel} className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg border border-border text-ink-soft">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg text-white bg-accent disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
