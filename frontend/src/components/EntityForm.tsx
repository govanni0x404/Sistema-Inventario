import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel";
};

const inputCls =
  "w-full font-body text-sm px-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block font-body text-xs font-medium mb-1 text-ink-soft">{label}</span>
      {children}
      {error && <span className="block font-body text-xs mt-1 text-warn">{error}</span>}
    </label>
  );
}

export default function EntityForm({
  fields,
  initial,
  fieldErrors,
  onCancel,
  onSave,
  saving,
}: {
  fields: FieldDef[];
  initial?: { [key: string]: unknown };
  fieldErrors?: Record<string, string[]>;
  onCancel: () => void;
  onSave: (data: Record<string, string>) => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] != null ? String(initial[f.key]) : ""]))
  );
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} error={fieldErrors?.[f.key]?.[0]}>
          <input
            className={inputCls}
            type={f.type || "text"}
            value={form[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            required={f.key === "nombre"}
          />
        </Field>
      ))}
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
