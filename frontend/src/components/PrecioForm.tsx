import { useState } from "react";
import type { FormEvent } from "react";
import type { Producto } from "../types/producto";

const inputCls =
  "w-full font-body text-sm px-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block font-body text-xs font-medium mb-1 text-ink-soft">{label}</span>
      {children}
      {error && <span className="block font-body text-xs mt-1 text-warn">{error}</span>}
    </label>
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
    <form onSubmit={handleSubmit}>
      <div className="mb-4 p-3 rounded-lg bg-bg font-body text-xs text-ink-soft">
        <span className="text-ink font-medium">{producto.nombre}</span>{" "}
        <span className="font-mono">{producto.sku}</span>
      </div>

      <Field label="Precio de compra" error={err("precioCompra")}>
        <input
          className={inputCls}
          value={precioCompra}
          onChange={(e) => setNumber(setPrecioCompra, e.target.value)}
          inputMode="decimal"
          required
        />
      </Field>
      <Field label="Precio de venta" error={err("precioVenta")}>
        <input
          className={inputCls}
          value={precioVenta}
          onChange={(e) => setNumber(setPrecioVenta, e.target.value)}
          inputMode="decimal"
          required
        />
      </Field>

      <div className="flex justify-between font-body text-xs text-ink-soft px-1 mb-5">
        <span>Margen</span>
        <span className={`font-mono font-medium ${margen < 0 ? "text-warn" : "text-accent"}`}>
          ${margen.toFixed(2)}
          {margenPct !== null && ` (${margenPct.toFixed(0)}%)`}
        </span>
      </div>

      <div className="flex gap-2">
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
