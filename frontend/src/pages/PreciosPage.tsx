import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Pencil, ChevronDown } from "lucide-react";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { HistorialPrecio } from "../types/historialPrecio";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PrecioForm from "../components/PrecioForm";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { cn } from "@/lib/utils";
import { LOCALE, money } from "../lib/format";


export default function PreciosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[] | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);

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
    return productos.filter((p) => (p.nombre + p.sku + (p.categoria?.nombre || "")).toLowerCase().includes(term));
  }, [productos, q]);

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(filtered, 10, q);

  const cargarHistorial = async (productoId: string) => {
    setHistorial(null);
    setHistorialCargando(true);
    try {
      setHistorial(await productosApi.historialPrecios(productoId));
    } catch {
      toast.error("No se pudo cargar el historial de precios");
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
      toast.success("Precios actualizados");
      const editandoId = editando.id;
      setEditando(null);
      if (expanded === editandoId) await cargarHistorial(editandoId);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Error al guardar los precios");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre, SKU o categoría" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <TableHead>Compra</TableHead>
                <TableHead>Margen</TableHead>
                <TableHead className="text-right">Venta</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => {
                const margen = p.precioVenta - p.precioCompra;
                return (
                  <Fragment key={p.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(p)}>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <ChevronDown
                            size={14}
                            className={cn("text-muted-foreground transition-transform shrink-0", expanded === p.id && "rotate-180")}
                          />
                          <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{money(p.precioCompra)}</TableCell>
                      <TableCell className={cn("font-mono text-sm", margen < 0 && "text-destructive")}>{money(margen)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(p.precioVenta)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFieldErrors(undefined);
                            setEditando(p);
                          }}
                          aria-label="Editar precios"
                        >
                          <Pencil size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded === p.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="bg-muted/40 whitespace-normal py-3">
                          <div className="font-body text-xs font-medium mb-2 text-muted-foreground">Historial de cambios de precio</div>
                          {historialCargando && <div className="font-body text-xs text-muted-foreground">Cargando…</div>}
                          {!historialCargando && historial && historial.length === 0 && (
                            <div className="font-body text-xs text-muted-foreground">Sin cambios registrados.</div>
                          )}
                          {!historialCargando && historial && historial.length > 0 && (
                            <div className="space-y-2">
                              {historial.map((h) => (
                                <div key={h.id} className="font-body text-xs">
                                  <div className="text-muted-foreground">
                                    {new Date(h.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                                    {h.usuario && <> · {h.usuario.nombre}</>}
                                  </div>
                                  <div className="flex gap-4 mt-0.5 font-mono">
                                    <span>
                                      Compra: {money(h.precioCompraAnterior)} → <span className="text-foreground">{money(h.precioCompraNuevo)}</span>
                                    </span>
                                    <span>
                                      Venta: {money(h.precioVentaAnterior)} → <span className="text-foreground">{money(h.precioVentaNuevo)}</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar precios</DialogTitle>
          </DialogHeader>
          {editando && (
            <PrecioForm producto={editando} fieldErrors={fieldErrors} onCancel={() => setEditando(null)} onSave={guardar} saving={saving} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
