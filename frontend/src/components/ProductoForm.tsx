import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Producto, ProductoInput } from "../types/producto";
import type { Proveedor } from "../types/proveedor";
import type { Categoria } from "../types/categoria";
import type { Unidad } from "../types/unidad";
import { proveedoresApi } from "../api/proveedores";
import { categoriasApi } from "../api/categorias";
import { unidadesApi } from "../api/unidades";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuickCreatePopover from "./QuickCreatePopover";
import { useAuth } from "../context/AuthContext";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type FormState = {
  sku: string;
  codigoBarras: string;
  nombre: string;
  categoriaId: string;
  precioVenta: string;
  stockMinimo: string;
  unidadId: string;
  proveedorId: string;
};

function toFormState(p?: Producto): FormState {
  return {
    sku: p?.sku ?? "",
    codigoBarras: p?.codigoBarras ?? "",
    nombre: p?.nombre ?? "",
    categoriaId: p?.categoriaId ?? "",
    precioVenta: p ? String(p.precioVenta) : "",
    stockMinimo: p ? String(p.stockMinimo) : "0",
    unidadId: p?.unidadId ?? "",
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
const SIN_CATEGORIA = "__none__";

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
  // Categorías y unidades solo las crea un admin (el backend responde 403 a los demás).
  const esAdmin = useAuth().usuario?.rol === "admin";
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  useEffect(() => {
    proveedoresApi.listar().then(setProveedores).catch(() => setProveedores([]));
    categoriasApi.listar(true).then(setCategorias).catch(() => setCategorias([]));
    unidadesApi.listar(true).then(setUnidades).catch(() => setUnidades([]));
  }, []);

  // Producto nuevo sin unidad elegida todavía: preselecciona la primera disponible en
  // cuanto carga el catálogo, para no obligar a elegir si solo hay una opción sensata.
  useEffect(() => {
    if (!form.unidadId && unidades.length > 0) {
      setForm((f) => (f.unidadId ? f : { ...f, unidadId: unidades[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades]);

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setNumber = (key: keyof FormState, value: string) => set(key, value.replace(/[^0-9.]/g, ""));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      sku: form.sku.trim(),
      codigoBarras: form.codigoBarras.trim() || null,
      nombre: form.nombre.trim(),
      categoriaId: form.categoriaId || null,
      precioVenta: Number(form.precioVenta) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
      unidadId: form.unidadId,
      proveedorId: form.proveedorId || null,
    });
  };

  const err = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial && (
        <div className="flex gap-4 p-3 rounded-lg bg-muted font-body text-xs text-muted-foreground">
          <span>
            Stock: <span className="font-mono text-foreground">{initial.stock}</span> {initial.unidad.nombre}
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
      <Field label="Código de barras" error={err("codigoBarras")}>
        <Input
          value={form.codigoBarras}
          onChange={(e) => set("codigoBarras", e.target.value)}
          placeholder="Opcional — escanea o escribe el código"
        />
      </Field>
      <Field label="Categoría">
        <div className="flex gap-2">
          <Select
            value={form.categoriaId || SIN_CATEGORIA}
            onValueChange={(v) => set("categoriaId", v === SIN_CATEGORIA ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="— Sin asignar —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_CATEGORIA}>— Sin asignar —</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {esAdmin && (
            <QuickCreatePopover
              label="Categoría"
              placeholder="Nombre de la categoría"
              onCreate={async (nombre) => {
                const nueva = await categoriasApi.crear({ nombre });
                setCategorias((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                set("categoriaId", nueva.id);
              }}
            />
          )}
        </div>
      </Field>
      <Field label="Precio de venta" error={err("precioVenta")}>
        <Input value={form.precioVenta} onChange={(e) => setNumber("precioVenta", e.target.value)} inputMode="decimal" required />
      </Field>
      <Field label="Stock mínimo" error={err("stockMinimo")}>
        <Input value={form.stockMinimo} onChange={(e) => setNumber("stockMinimo", e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Unidad" error={err("unidadId")}>
        <div className="flex gap-2">
          <Select value={form.unidadId} onValueChange={(v) => set("unidadId", v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una unidad" />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {esAdmin && (
            <QuickCreatePopover
              label="Unidad"
              placeholder="Ej. Kg, Litro, Caja"
              onCreate={async (nombre) => {
                const nueva = await unidadesApi.crear({ nombre });
                setUnidades((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                set("unidadId", nueva.id);
              }}
            />
          )}
        </div>
      </Field>
      <Field label="Proveedor">
        <div className="flex gap-2">
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
          <QuickCreatePopover
            label="Proveedor"
            placeholder="Nombre del proveedor"
            onCreate={async (nombre) => {
              const nuevo = await proveedoresApi.crear({ nombre });
              setProveedores((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
              set("proveedorId", nuevo.id);
            }}
          />
        </div>
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
