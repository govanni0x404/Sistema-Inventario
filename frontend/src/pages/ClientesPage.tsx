import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { clientesApi } from "../api/clientes";
import { ApiError } from "../api/client";
import type { Cliente, ClienteConVentas, ClienteInput } from "../types/cliente";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import EntityForm, { type FieldDef } from "../components/EntityForm";
import Toast from "../components/Toast";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const fields: FieldDef[] = [
  { key: "nombre", label: "Nombre" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Correo", type: "email" },
  { key: "direccion", label: "Dirección" },
];

type ModalState = { mode: "new" } | { mode: "edit"; data: Cliente } | null;

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ClienteConVentas | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);

  const notify = (text: string, variant: "success" | "error" = "success") => setToast({ text, variant });

  const cargar = async () => {
    try {
      setLoadError(null);
      setClientes(await clientesApi.listar());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtered = useMemo(() => {
    if (!clientes) return [];
    const term = q.toLowerCase();
    return clientes.filter((c) => c.nombre.toLowerCase().includes(term));
  }, [clientes, q]);

  const toggleExpand = async (cliente: Cliente) => {
    if (expanded === cliente.id) {
      setExpanded(null);
      setDetalle(null);
      return;
    }
    setExpanded(cliente.id);
    setDetalle(null);
    setDetalleCargando(true);
    try {
      setDetalle(await clientesApi.obtener(cliente.id));
    } catch {
      notify("No se pudo cargar el historial de compras", "error");
    } finally {
      setDetalleCargando(false);
    }
  };

  const save = async (data: Record<string, string>) => {
    if (!modal) return;
    setSaving(true);
    setFieldErrors(undefined);
    const input: ClienteInput = {
      nombre: data.nombre.trim(),
      telefono: data.telefono?.trim() || undefined,
      email: data.email?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
    };
    try {
      if (modal.mode === "new") {
        const creado = await clientesApi.crear(input);
        setClientes((prev) => (prev ? [...prev, creado] : [creado]));
        notify("Cliente creado");
      } else {
        const actualizado = await clientesApi.actualizar(modal.data.id, input);
        setClientes((prev) => prev?.map((c) => (c.id === actualizado.id ? actualizado : c)) ?? null);
        notify("Cliente actualizado");
      }
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        notify(e.message, "error");
      } else {
        notify("Error al guardar el cliente", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await clientesApi.eliminar(deleteTarget.id);
      setClientes((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? null);
      notify("Cliente eliminado");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "No se pudo eliminar el cliente", "error");
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
            placeholder="Buscar por nombre"
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
      {!loadError && clientes === null && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando clientes…</div>
      )}
      {!loadError && clientes !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">No hay clientes registrados.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <button onClick={() => toggleExpand(c)} className="w-full flex items-center gap-4 p-4 text-left">
                <div className="flex-1 min-w-0">
                  <div className="font-body font-medium text-sm text-ink">{c.nombre}</div>
                  <div className="font-body text-xs mt-0.5 truncate text-ink-soft">
                    {[c.telefono, c.email, c.direccion].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-ink-soft transition-transform ${expanded === c.id ? "rotate-180" : ""}`}
                />
                <div className="flex gap-1 shrink-0">
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFieldErrors(undefined);
                      setModal({ mode: "edit", data: c });
                    }}
                    className="p-1.5 rounded-lg text-ink-soft"
                  >
                    <Pencil size={15} />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(c);
                    }}
                    className="p-1.5 rounded-lg text-warn"
                  >
                    <Trash2 size={15} />
                  </span>
                </div>
              </button>

              {expanded === c.id && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="font-body text-xs font-medium mt-3 mb-2 text-ink-soft">Historial de compras</div>
                  {detalleCargando && <div className="font-body text-xs text-ink-soft">Cargando…</div>}
                  {!detalleCargando && detalle && detalle.ventas.length === 0 && (
                    <div className="font-body text-xs text-ink-soft">Este cliente aún no tiene compras.</div>
                  )}
                  {!detalleCargando && detalle && detalle.ventas.length > 0 && (
                    <div className="space-y-1.5">
                      {detalle.ventas.map((v) => (
                        <div key={v.id} className="flex justify-between font-mono text-xs text-ink-soft">
                          <span>
                            {new Date(v.fecha).toLocaleDateString("es-MX")} · {v.metodoPago} · {v.items.length} ítem(s)
                          </span>
                          <span className="text-accent font-semibold">{money(v.total)}</span>
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
        <Modal title={modal.mode === "new" ? "Nuevo cliente" : "Editar cliente"} onClose={() => setModal(null)}>
          <EntityForm
            fields={fields}
            initial={modal.mode === "edit" ? (modal.data as unknown as Record<string, unknown>) : undefined}
            fieldErrors={fieldErrors}
            onCancel={() => setModal(null)}
            onSave={save}
            saving={saving}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`¿Eliminar a "${deleteTarget.nombre}"?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
