import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto, ProductoInput } from "../types/producto";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import ProductoForm from "../components/ProductoForm";

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
        toast.success("Producto creado");
      } else {
        const actualizado = await productosApi.actualizar(modal.data.id, data);
        setProductos((prev) => prev?.map((p) => (p.id === actualizado.id ? actualizado : p)) ?? null);
        toast.success("Producto actualizado");
      }
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Error al guardar el producto");
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productosApi.eliminar(deleteTarget.id);
      setProductos((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? null);
      toast.success("Producto eliminado");
    } catch (e) {
      if (e instanceof ApiError && e.status === 200) {
        await cargar();
        toast("El producto tenía ventas asociadas: se desactivó en lugar de eliminarse");
      } else {
        toast.error("No se pudo eliminar el producto");
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, SKU o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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

      {!loadError && productos === null && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!loadError && productos !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay productos que coincidan.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const low = p.stock <= p.stockMinimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.sku}</span>
                        {!p.activo && <Badge variant="outline">Inactivo</Badge>}
                        {low && (
                          <Badge variant="warning">
                            <AlertTriangle size={11} /> Stock bajo
                          </Badge>
                        )}
                      </div>
                      {p.proveedor && (
                        <div className="font-body text-xs text-muted-foreground mt-0.5">{p.proveedor.nombre}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">{p.categoria || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {p.stock} <span className="text-muted-foreground">{p.unidad}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                      {money(p.precioVenta)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
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
                          onClick={() => setDeleteTarget(p)}
                          aria-label="Eliminar"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.mode === "new" ? "Nuevo producto" : "Editar producto"}</DialogTitle>
          </DialogHeader>
          {modal && (
            <ProductoForm
              initial={modal.mode === "edit" ? modal.data : undefined}
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
        title="Eliminar producto"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Si ya tiene ventas registradas, en su lugar se desactivará.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
