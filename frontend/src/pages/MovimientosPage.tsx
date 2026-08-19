import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { productosApi } from "../api/productos";
import { movimientosApi } from "../api/movimientos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { MovimientoStock, TipoMovimiento } from "../types/movimiento";
import Modal from "../components/Modal";
import MovimientoForm from "../components/MovimientoForm";
import Toast from "../components/Toast";

export default function MovimientosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historial, setHistorial] = useState<MovimientoStock[] | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [modal, setModal] = useState<{ producto: Producto; tipo: TipoMovimiento } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);

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
      setHistorial(await movimientosApi.listar(productoId));
    } catch {
      notify("No se pudo cargar el historial de movimientos", "error");
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

  const guardar = async (data: { cantidad: number; motivo?: string }) => {
    if (!modal) return;
    setSaving(true);
    setFieldErrors(undefined);
    try {
      await movimientosApi.crear(modal.producto.id, { tipo: modal.tipo, ...data });
      notify(modal.tipo === "entrada" ? "Entrada registrada" : "Salida registrada");
      setModal(null);
      await cargar();
      if (expanded === modal.producto.id) await cargarHistorial(modal.producto.id);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        notify(e.message, "error");
      } else {
        notify("Error al registrar el movimiento", "error");
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
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggleExpand(p)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-medium text-sm text-ink">{p.nombre}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg text-ink-soft">{p.sku}</span>
                    </div>
                    <div className="font-body text-xs mt-0.5 text-ink-soft">
                      Stock actual: <span className="font-mono">{p.stock}</span> {p.unidad}
                    </div>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform ${expanded === p.id ? "rotate-180" : ""}`} />
                </button>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setFieldErrors(undefined);
                      setModal({ producto: p, tipo: "entrada" });
                    }}
                    className="flex items-center gap-1 font-body text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent-soft text-accent-dark"
                  >
                    <ArrowDownCircle size={13} /> Entrada
                  </button>
                  <button
                    onClick={() => {
                      setFieldErrors(undefined);
                      setModal({ producto: p, tipo: "salida" });
                    }}
                    className="flex items-center gap-1 font-body text-xs font-medium px-2.5 py-1.5 rounded-lg bg-warn-soft text-warn"
                  >
                    <ArrowUpCircle size={13} /> Salida
                  </button>
                </div>
              </div>

              {expanded === p.id && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="font-body text-xs font-medium mt-3 mb-2 text-ink-soft">Historial de movimientos</div>
                  {historialCargando && <div className="font-body text-xs text-ink-soft">Cargando…</div>}
                  {!historialCargando && historial && historial.length === 0 && (
                    <div className="font-body text-xs text-ink-soft">Sin movimientos registrados.</div>
                  )}
                  {!historialCargando && historial && historial.length > 0 && (
                    <div className="space-y-2">
                      {historial.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 font-body text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.tipo === "entrada" ? (
                              <ArrowDownCircle size={14} className="text-accent shrink-0" />
                            ) : (
                              <ArrowUpCircle size={14} className="text-warn shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-ink truncate">
                                {m.tipo === "entrada" ? "Entrada" : "Salida"} de {m.cantidad} {p.unidad}
                                {m.origen === "venta" && <span className="text-ink-soft"> · venta</span>}
                              </div>
                              <div className="text-ink-soft truncate">
                                {new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                                {m.usuario && <> · {m.usuario.nombre}</>}
                                {m.motivo && <> · {m.motivo}</>}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-ink-soft shrink-0">→ {m.stockResultante}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"} onClose={() => setModal(null)}>
          <MovimientoForm
            producto={modal.producto}
            tipo={modal.tipo}
            fieldErrors={fieldErrors}
            onCancel={() => setModal(null)}
            onSave={guardar}
            saving={saving}
          />
        </Modal>
      )}

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
