import { useState } from "react";
import type { FormEvent } from "react";
import type { Producto } from "../types/producto";
import type { TipoMovimiento } from "../types/movimiento";

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
    <form onSubmit={handleSubmit}>
      <div className="mb-4 p-3 rounded-lg bg-bg font-body text-xs text-ink-soft">
        <span className="text-ink font-medium">{producto.nombre}</span> <span className="font-mono">{producto.sku}</span>
        <div className="mt-0.5">
          Stock actual: <span className="font-mono text-ink">{producto.stock}</span> {producto.unidad}
        </div>
      </div>

      <Field label={`Cantidad a ${tipo === "entrada" ? "ingresar" : "retirar"} (${producto.unidad})`} error={err("cantidad")}>
        <input
          className={inputCls}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          autoFocus
          required
        />
      </Field>
      <Field label="Motivo (opcional)">
        <input
          className={inputCls}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={tipo === "entrada" ? "Compra a proveedor, devolución..." : "Merma, ajuste, uso interno..."}
        />
      </Field>

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onCancel} className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg border border-border text-ink-soft">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`flex-1 font-body text-sm font-medium py-2.5 rounded-lg text-white disabled:opacity-60 ${
            tipo === "entrada" ? "bg-accent" : "bg-warn"
          }`}
        >
          {saving ? "Guardando..." : tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
        </button>
      </div>
    </form>
  );
}
