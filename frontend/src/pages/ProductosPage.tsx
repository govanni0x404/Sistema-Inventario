import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto, ProductoInput } from "../types/producto";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import ProductoForm from "../components/ProductoForm";
import Toast from "../components/Toast";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type ModalState = { mode: "new" } | { mode: "edit"; data: Producto } | null;

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);

  const notify = (text: string, variant: "success" | "error" = "success") => setToast({ text, variant });

  const cargar = async () => {
    try {
      setLoadError(null);
      const data = await productosApi.listar();
      setProductos(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtered = useMemo(() => {
    if (!productos) return [];
    const term = q.toLowerCase();
    return productos.filter((p) => (p.nombre + p.sku + (p.categoria || "")).toLowerCase().includes(term));
  }, [productos, q]);

  const save = async (data: ProductoInput) => {
    if (!modal) return;
    setSaving(true);
    setFieldErrors(undefined);
    try {
      if (modal.mode === "new") {
        const creado = await productosApi.crear(data);
        setProductos((prev) => (prev ? [...prev, creado] : [creado]));
        notify("Producto creado");
      } else {
        const actualizado = await productosApi.actualizar(modal.data.id, data);
        setProductos((prev) => prev?.map((p) => (p.id === actualizado.id ? actualizado : p)) ?? null);
        notify("Producto actualizado");
      }
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        notify(e.message, "error");
      } else {
        notify("Error al guardar el producto", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const resultado = await productosApi.eliminar(deleteTarget.id);
      if (resultado?._desactivado) {
        setProductos((prev) => prev?.map((p) => (p.id === resultado.id ? resultado : p)) ?? null);
        notify("El producto tenía ventas asociadas: se desactivó en lugar de eliminarse");
      } else {
        setProductos((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? null);
        notify("Producto eliminado");
      }
    } catch {
      notify("No se pudo eliminar el producto", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            className="w-full font-body text-sm pl-9 pr-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors"
            placeholder="Buscar por nombre, SKU o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            setFieldErrors(undefined);
            setModal({ mode: "new" });
          }}
          className="flex items-center gap-1 font-body text-sm font-medium px-3.5 py-2 rounded-lg text-white bg-accent shrink-0"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-warn">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}

      {!loadError && productos === null && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando productos…</div>
      )}

      {!loadError && productos !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">No hay productos que coincidan.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const low = p.stock <= p.stockMinimo;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-medium text-sm text-ink">{p.nombre}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg text-ink-soft">{p.sku}</span>
                    {!p.activo && (
                      <span className="font-body text-xs px-1.5 py-0.5 rounded bg-bg text-ink-soft">Inactivo</span>
                    )}
                    {low && (
                      <span className="flex items-center gap-1 font-body text-xs px-1.5 py-0.5 rounded bg-warn-soft text-warn">
                        <AlertTriangle size={11} /> Stock bajo
                      </span>
                    )}
                  </div>
                  <div className="font-body text-xs mt-0.5 text-ink-soft">
                    {p.categoria || "Sin categoría"} · Stock: <span className="font-mono">{p.stock}</span> {p.unidad}
                    {p.proveedor && <> · {p.proveedor.nombre}</>}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold shrink-0 text-accent">{money(p.precioVenta)}</div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setFieldErrors(undefined);
                      setModal({ mode: "edit", data: p });
                    }}
                    className="p-1.5 rounded-lg text-ink-soft"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-warn" aria-label="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "new" ? "Nuevo producto" : "Editar producto"} onClose={() => setModal(null)}>
          <ProductoForm
            initial={modal.mode === "edit" ? modal.data : undefined}
            fieldErrors={fieldErrors}
            onCancel={() => setModal(null)}
            onSave={save}
            saving={saving}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar producto"
          message={`¿Eliminar "${deleteTarget.nombre}"? Si ya tiene ventas registradas, en su lugar se desactivará.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
