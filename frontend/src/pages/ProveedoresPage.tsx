import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { proveedoresApi } from "../api/proveedores";
import { ApiError } from "../api/client";
import type { Proveedor, ProveedorConProductos, ProveedorInput } from "../types/proveedor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import EntityForm, { type FieldDef } from "../components/EntityForm";
import { cn } from "@/lib/utils";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const fields: FieldDef[] = [
  { key: "nombre", label: "Nombre" },
  { key: "contacto", label: "Persona de contacto" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Correo", type: "email" },
];

type ModalState = { mode: "new" } | { mode: "edit"; data: Proveedor } | null;

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ProveedorConProductos | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);

  const cargar = async () => {
    try {
      setLoadError(null);
      setProveedores(await proveedoresApi.listar());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtered = useMemo(() => {
    if (!proveedores) return [];
    const term = q.toLowerCase();
    return proveedores.filter((p) => p.nombre.toLowerCase().includes(term));
  }, [proveedores, q]);

  const toggleExpand = async (proveedor: Proveedor) => {
    if (expanded === proveedor.id) {
      setExpanded(null);
      setDetalle(null);
      return;
    }
    setExpanded(proveedor.id);
    setDetalle(null);
    setDetalleCargando(true);
    try {
      setDetalle(await proveedoresApi.obtener(proveedor.id));
    } catch {
      toast.error("No se pudieron cargar los productos asociados");
    } finally {
      setDetalleCargando(false);
    }
  };

  const save = async (data: Record<string, string>) => {
    if (!modal) return;
    setSaving(true);
    setFieldErrors(undefined);
    const input: ProveedorInput = {
      nombre: data.nombre.trim(),
      contacto: data.contacto?.trim() || undefined,
      telefono: data.telefono?.trim() || undefined,
      email: data.email?.trim() || undefined,
    };
    try {
      if (modal.mode === "new") {
        const creado = await proveedoresApi.crear(input);
        setProveedores((prev) => (prev ? [...prev, creado] : [creado]));
        toast.success("Proveedor creado");
      } else {
        const actualizado = await proveedoresApi.actualizar(modal.data.id, input);
        setProveedores((prev) => prev?.map((p) => (p.id === actualizado.id ? actualizado : p)) ?? null);
        toast.success("Proveedor actualizado");
      }
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Error al guardar el proveedor");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await proveedoresApi.eliminar(deleteTarget.id);
      setProveedores((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? null);
      toast.success("Proveedor eliminado");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar el proveedor");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
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
      {!loadError && proveedores === null && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {!loadError && proveedores !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay proveedores registrados.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <Fragment key={p.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(p)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          size={14}
                          className={cn("text-muted-foreground transition-transform shrink-0", expanded === p.id && "rotate-180")}
                        />
                        <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-body text-xs text-muted-foreground">
                      {[p.contacto, p.telefono, p.email].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFieldErrors(undefined);
                            setModal({ mode: "edit", data: p });
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
                            setDeleteTarget(p);
                          }}
                          aria-label="Eliminar"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded === p.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="bg-muted/40 whitespace-normal py-3">
                        <div className="font-body text-xs font-medium mb-2 text-muted-foreground">Productos asociados</div>
                        {detalleCargando && <div className="font-body text-xs text-muted-foreground">Cargando…</div>}
                        {!detalleCargando && detalle && detalle.productos.length === 0 && (
                          <div className="font-body text-xs text-muted-foreground">Este proveedor no tiene productos asociados.</div>
                        )}
                        {!detalleCargando && detalle && detalle.productos.length > 0 && (
                          <div className="space-y-1.5">
                            {detalle.productos.map((prod) => (
                              <div key={prod.id} className="flex justify-between font-mono text-xs text-muted-foreground">
                                <span>
                                  {prod.nombre} <span className="opacity-60">({prod.sku})</span>
                                </span>
                                <span className="text-primary font-semibold">{money(prod.precioVenta)}</span>
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

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.mode === "new" ? "Nuevo proveedor" : "Editar proveedor"}</DialogTitle>
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
        title="Eliminar proveedor"
        message={`¿Eliminar a "${deleteTarget?.nombre}"?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
