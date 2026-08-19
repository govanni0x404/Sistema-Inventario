import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel";
};

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} error={fieldErrors?.[f.key]?.[0]}>
          <Input
            type={f.type || "text"}
            value={form[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            required={f.key === "nombre"}
            aria-invalid={!!fieldErrors?.[f.key]}
          />
        </Field>
      ))}
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
