import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Barcode, Search, Plus } from "lucide-react";
// import { Upload } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto, ProductoInput } from "../types/producto";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import ProductoForm from "../components/ProductoForm";
// import ImportarProductosDialog from "../components/ImportarProductosDialog";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { matchesSearch, normalizeSearch } from "../lib/search";


type ModalState = { mode: "new" } | { mode: "edit"; data: Producto } | null;

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  // const [importando, setImportando] = useState(false);

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
    const term = normalizeSearch(q);
    return productos.filter((p) => matchesSearch(term, [p.nombre, p.codigoBarras, p.categoria?.nombre, p.subfamilia]));
  }, [productos, q]);

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(filtered, 10, q);

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
      const resultado = await productosApi.eliminar(deleteTarget.id);
      if (resultado?._desactivado) {
        await cargar();
        toast("El producto tenía ventas asociadas: se desactivó en lugar de eliminarse");
      } else {
        setProductos((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? null);
        toast.success("Producto eliminado");
      }
      setModal(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar el producto");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="h-10 pl-9"
            aria-label="Buscar producto por nombre, código de barras o familia"
            placeholder="Buscar por nombre, código de barras o familia…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {/* El acceso a la importación se moverá a otra vista.
        <Button variant="outline" className="h-10" onClick={() => setImportando(true)}>
          <Upload size={16} /> Importar
        </Button>
        */}
        <Button
          className="h-10"
          onClick={() => {
            setFieldErrors(undefined);
            setModal({ mode: "new" });
          }}
        >
          <Plus size={16} /> Nuevo producto
        </Button>
      </div>

      <section aria-label="Listado de productos" className="flex min-h-80 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <Table aria-label="Productos del catálogo" className="min-w-[33rem]">
          <TableHeader className="bg-muted/70">
            <TableRow>
              <TableHead scope="col" className="w-[22%] pl-4 sm:pl-5">Código de barras</TableHead>
              <TableHead scope="col" className="w-[46%]">Nombre</TableHead>
              <TableHead scope="col">Familia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loadError && pageItems.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => {
                setFieldErrors(undefined);
                setModal({ mode: "edit", data: p });
              }}>
                <TableCell className="pl-4 font-mono tabular-nums sm:pl-5">
                  {p.codigoBarras ? (
                    <span className="inline-flex items-center gap-2"><Barcode size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />{p.codigoBarras}</span>
                  ) : <span className="font-body text-muted-foreground">Sin código</span>}
                </TableCell>
                <TableCell className="font-medium whitespace-normal [overflow-wrap:anywhere]">
                  <button type="button" className="rounded text-left hover:text-primary hover:underline focus-visible:underline"
                    aria-label={`Editar ${p.nombre}`} onClick={(event) => {
                      event.stopPropagation();
                      setFieldErrors(undefined);
                      setModal({ mode: "edit", data: p });
                    }}>{p.nombre}</button>
                  {!p.activo && <Badge variant="outline" className="ml-2">Inactivo</Badge>}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground [overflow-wrap:anywhere]">{p.categoria?.nombre ?? "Sin familia"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loadError && (
          <p role="alert" className="px-4 py-8 text-center text-sm text-destructive">
            {loadError} <button type="button" className="ml-1 underline" onClick={cargar}>Reintentar</button>
          </p>
        )}
        {!loadError && productos === null && (
          <div role="status" aria-label="Cargando productos" className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {!loadError && productos !== null && filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {productos.length === 0 ? "Aún no hay productos registrados." : "No hay productos que coincidan con la búsqueda."}
          </p>
        )}
        {!loadError && totalItems > pageSize && (
          <div className="mt-auto border-t px-4 pb-4">
            <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </section>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] gap-5 overflow-y-auto rounded-2xl p-5 sm:max-w-[min(94vw,88rem)] sm:p-7 lg:p-8 [&>button]:size-9 [&>button]:text-foreground">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-2xl leading-tight sm:text-3xl">{modal?.mode === "new" ? "Nuevo producto" : "Editar producto"}</DialogTitle>
            <DialogDescription className="sr-only">Datos, clasificación y precios del producto.</DialogDescription>
          </DialogHeader>
          {modal && (
            <ProductoForm
              initial={modal.mode === "edit" ? modal.data : undefined}
              catalogo={productos ?? []}
              fieldErrors={fieldErrors}
              onCancel={() => setModal(null)}
              onDelete={modal.mode === "edit" ? () => setDeleteTarget(modal.data) : undefined}
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

      {/* {importando && <ImportarProductosDialog onClose={() => setImportando(false)} onImportado={cargar} />} */}
    </div>
  );
}
