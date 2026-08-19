import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, ChevronDown } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { HistorialPrecio } from "../types/historialPrecio";
import Modal from "../components/Modal";
import PrecioForm from "../components/PrecioForm";
import Toast from "../components/Toast";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function PreciosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[] | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);

  const notify = (text: string, variant: "success" | "error" = "success") => setToast({ text, variant });

  const cargar = async () => {
    try {
      setLoadError(null);
      setProductos(await productosApi.listar());
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

  const cargarHistorial = async (productoId: string) => {
    setHistorial(null);
    setHistorialCargando(true);
    try {
      setHistorial(await productosApi.historialPrecios(productoId));
    } catch {
      notify("No se pudo cargar el historial de precios", "error");
    } finally {
      setHistorialCargando(false);
    }
  };

  const toggleExpand = (p: Producto) => {
    if (expanded === p.id) {
      setExpanded(null);
      setHistorial(null);
      return;
    }
    setExpanded(p.id);
    cargarHistorial(p.id);
  };

  const guardar = async (data: { precioCompra: number; precioVenta: number }) => {
    if (!editando) return;
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const actualizado = await productosApi.actualizar(editando.id, data);
      setProductos((prev) => prev?.map((p) => (p.id === actualizado.id ? actualizado : p)) ?? null);
      notify("Precios actualizados");
      const editandoId = editando.id;
      setEditando(null);
      if (expanded === editandoId) await cargarHistorial(editandoId);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        notify(e.message, "error");
      } else {
        notify("Error al guardar los precios", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          className="w-full font-body text-sm pl-9 pr-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors"
          placeholder="Buscar por nombre, SKU o categoría"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-warn">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}
      {!loadError && productos === null && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando…</div>
      )}
      {!loadError && productos !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">No hay productos que coincidan.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const margen = p.precioVenta - p.precioCompra;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleExpand(p)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-medium text-sm text-ink">{p.nombre}</span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg text-ink-soft">{p.sku}</span>
                      </div>
                      <div className="font-body text-xs mt-0.5 text-ink-soft">
                        Compra: <span className="font-mono">{money(p.precioCompra)}</span> · Margen:{" "}
                        <span className={`font-mono ${margen < 0 ? "text-warn" : ""}`}>{money(margen)}</span>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform ${expanded === p.id ? "rotate-180" : ""}`} />
                  </button>
                  <div className="font-mono text-sm font-semibold shrink-0 text-accent">{money(p.precioVenta)}</div>
                  <button
                    onClick={() => {
                      setFieldErrors(undefined);
                      setEditando(p);
                    }}
                    className="p-1.5 rounded-lg text-ink-soft shrink-0"
                    aria-label="Editar precios"
                  >
                    <Pencil size={15} />
                  </button>
                </div>

                {expanded === p.id && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="font-body text-xs font-medium mt-3 mb-2 text-ink-soft">Historial de cambios de precio</div>
                    {historialCargando && <div className="font-body text-xs text-ink-soft">Cargando…</div>}
                    {!historialCargando && historial && historial.length === 0 && (
                      <div className="font-body text-xs text-ink-soft">Sin cambios registrados.</div>
                    )}
                    {!historialCargando && historial && historial.length > 0 && (
                      <div className="space-y-2">
                        {historial.map((h) => (
                          <div key={h.id} className="font-body text-xs">
                            <div className="text-ink-soft">
                              {new Date(h.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                              {h.usuario && <> · {h.usuario.nombre}</>}
                            </div>
                            <div className="flex gap-4 mt-0.5 font-mono">
                              <span>
                                Compra: {money(h.precioCompraAnterior)} → <span className="text-ink">{money(h.precioCompraNuevo)}</span>
                              </span>
                              <span>
                                Venta: {money(h.precioVentaAnterior)} → <span className="text-ink">{money(h.precioVentaNuevo)}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <Modal title="Editar precios" onClose={() => setEditando(null)}>
          <PrecioForm
            producto={editando}
            fieldErrors={fieldErrors}
            onCancel={() => setEditando(null)}
            onSave={guardar}
            saving={saving}
          />
        </Modal>
      )}

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
