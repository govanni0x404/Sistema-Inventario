import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { permisosApi } from "../api/permisos";
import { ApiError } from "../api/client";
import type { Seccion } from "../types/auth";
import Toggle from "../components/Toggle";
import Toast from "../components/Toast";

const ETIQUETAS: Record<Seccion, { label: string; desc: string }> = {
  caja: { label: "Caja", desc: "Vender productos y cobrar" },
  productos: { label: "Productos", desc: "Crear, editar y eliminar productos" },
  stock: { label: "Stock", desc: "Ver existencias actuales" },
  bodega: { label: "Bodega", desc: "Registrar entradas y salidas de stock" },
  precios: { label: "Precios", desc: "Ver historial de cambios de precio" },
  clientes: { label: "Clientes", desc: "Gestionar clientes" },
  proveedores: { label: "Proveedores", desc: "Gestionar proveedores" },
  historial: { label: "Historial", desc: "Ver historial de ventas" },
};

const ROL_LABEL: Record<string, string> = { cajero: "Cajero" };

export default function PermisosPage() {
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permisos, setPermisos] = useState<Record<string, Record<Seccion, boolean>> | null>(null);
  const [original, setOriginal] = useState<Record<string, Record<Seccion, boolean>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);

  const notify = (text: string, variant: "success" | "error" = "success") => setToast({ text, variant });

  const cargar = async () => {
    try {
      setLoadError(null);
      const data = await permisosApi.listar();
      setSecciones(data.secciones);
      setRoles(data.roles);
      setPermisos(data.permisos);
      setOriginal(data.permisos);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const toggle = (rol: string, seccion: Seccion) => {
    setPermisos((prev) => {
      if (!prev) return prev;
      return { ...prev, [rol]: { ...prev[rol], [seccion]: !prev[rol][seccion] } };
    });
  };

  const hayCambios =
    permisos && original && roles.some((rol) => secciones.some((s) => permisos[rol][s] !== original[rol][s]));

  const guardar = async () => {
    if (!permisos || !original) return;
    const cambios = roles.flatMap((rol) =>
      secciones
        .filter((seccion) => permisos[rol][seccion] !== original[rol][seccion])
        .map((seccion) => ({ rol, seccion, permitido: permisos[rol][seccion] }))
    );
    if (cambios.length === 0) return;

    setSaving(true);
    try {
      const data = await permisosApi.actualizar(cambios);
      setPermisos(data.permisos);
      setOriginal(data.permisos);
      notify("Permisos actualizados");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "No se pudieron guardar los permisos", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="font-body text-sm text-center py-10 text-warn">
        {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
      </div>
    );
  }

  if (!permisos) {
    return <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando…</div>;
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-bg">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-soft text-accent-dark shrink-0">
          <ShieldCheck size={16} />
        </span>
        <p className="font-body text-xs text-ink-soft">
          Controla qué secciones puede ver y usar cada rol. El rol <strong className="text-ink">admin</strong> siempre
          tiene acceso total y no aparece aquí, para evitar quedarse sin acceso a esta misma pantalla.
        </p>
      </div>

      {roles.map((rol) => (
        <div key={rol} className="mb-6">
          <h3 className="font-display text-sm font-semibold text-ink mb-2">{ROL_LABEL[rol] || rol}</h3>
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {secciones.map((seccion) => (
              <div key={seccion} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="font-body text-sm text-ink">{ETIQUETAS[seccion].label}</div>
                  <div className="font-body text-xs text-ink-soft">{ETIQUETAS[seccion].desc}</div>
                </div>
                <Toggle checked={permisos[rol][seccion]} onChange={() => toggle(rol, seccion)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={guardar}
          disabled={!hayCambios || saving}
          className="font-body text-sm font-medium px-5 py-2.5 rounded-lg text-white bg-accent disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
