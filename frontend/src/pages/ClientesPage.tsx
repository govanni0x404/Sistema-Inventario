import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { clientesApi } from "../api/clientes";
import { ApiError } from "../api/client";
import type { Cliente, ClienteConVentas, ClienteInput } from "../types/cliente";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import EntityForm, { type FieldDef } from "../components/EntityForm";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { cn } from "@/lib/utils";
import { LOCALE, money } from "../lib/format";


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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ClienteConVentas | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);

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

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(filtered, 10, q);

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
      toast.error("No se pudo cargar el historial de compras");
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
        toast.success("Cliente creado");
      } else {
        const actualizado = await clientesApi.actualizar(modal.data.id, input);
        setClientes((prev) => prev?.map((c) => (c.id === actualizado.id ? actualizado : c)) ?? null);
        toast.success("Cliente actualizado");
      }
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Error al guardar el cliente");
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
      toast.success("Cliente eliminado");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar el cliente");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            setFieldErrors(undefined);
            setModal({ mode: "new" });
          }}
        >
          <Plus size={16} /> Nuevo
        </Button>
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-destructive">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}
      {!loadError && clientes === null && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {!loadError && clientes !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay clientes registrados.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((c) => (
                <Fragment key={c.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(c)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          size={14}
                          className={cn("text-muted-foreground transition-transform shrink-0", expanded === c.id && "rotate-180")}
                        />
                        <span className="font-body font-medium text-sm text-foreground">{c.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-body text-xs text-muted-foreground">
                      {[c.telefono, c.email, c.direccion].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFieldErrors(undefined);
                            setModal({ mode: "edit", data: c });
                          }}
                          aria-label="Editar"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(c);
                          }}
                          aria-label="Eliminar"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded === c.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="bg-muted/40 whitespace-normal py-3">
                        <div className="font-body text-xs font-medium mb-2 text-muted-foreground">Historial de compras</div>
                        {detalleCargando && <div className="font-body text-xs text-muted-foreground">Cargando…</div>}
                        {!detalleCargando && detalle && detalle.ventas.length === 0 && (
                          <div className="font-body text-xs text-muted-foreground">Este cliente aún no tiene compras.</div>
                        )}
                        {!detalleCargando && detalle && detalle.ventas.length > 0 && (
                          <div className="space-y-1.5">
                            {detalle.ventas.map((v) => (
                              <div key={v.id} className="flex justify-between font-mono text-xs text-muted-foreground">
                                <span>
                                  {new Date(v.fecha).toLocaleDateString(LOCALE)} · {v.pagos.map((p) => p.metodoPago).join(" + ")} · {v.items.length} ítem(s)
                                </span>
                                <span className="text-primary font-semibold">{money(v.total)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.mode === "new" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
          </DialogHeader>
          {modal && (
            <EntityForm
              fields={fields}
              initial={modal.mode === "edit" ? (modal.data as unknown as Record<string, unknown>) : undefined}
              fieldErrors={fieldErrors}
              onCancel={() => setModal(null)}
              onSave={save}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar cliente"
        message={`¿Eliminar a "${deleteTarget?.nombre}"?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
