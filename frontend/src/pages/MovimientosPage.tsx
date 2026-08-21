import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, ChevronDown, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { productosApi } from "../api/productos";
import { movimientosApi } from "../api/movimientos";
import { bodegasApi } from "../api/bodegas";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { MovimientoStock, TipoMovimiento } from "../types/movimiento";
import type { Bodega } from "../types/bodega";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MovimientoForm from "../components/MovimientoForm";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { cn } from "@/lib/utils";

export default function MovimientosPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historial, setHistorial] = useState<MovimientoStock[] | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [modal, setModal] = useState<{ producto: Producto; tipo: TipoMovimiento } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();

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
    bodegasApi.listar(true).then(setBodegas).catch(() => setBodegas([]));
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
      setHistorial(await movimientosApi.listar(productoId));
    } catch {
      toast.error("No se pudo cargar el historial de movimientos");
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

  const guardar = async (data: { cantidad: number; motivo?: string; bodegaId?: string }) => {
    if (!modal) return;
    setSaving(true);
    setFieldErrors(undefined);
    try {
      await movimientosApi.crear(modal.producto.id, { tipo: modal.tipo, ...data });
      toast.success(modal.tipo === "entrada" ? "Entrada registrada" : "Salida registrada");
      setModal(null);
      await cargar();
      if (expanded === modal.producto.id) await cargarHistorial(modal.producto.id);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors((e.detalles as { fieldErrors?: Record<string, string[]> })?.fieldErrors);
        toast.error(e.message);
      } else {
        toast.error("Error al registrar el movimiento");
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
                <TableHead>Stock actual</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="cursor-pointer" onClick={() => toggleExpand(p)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <ChevronDown
                          size={14}
                          className={cn("text-muted-foreground transition-transform shrink-0", expanded === p.id && "rotate-180")}
                        />
                        <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {p.stock} {p.unidad.nombre}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setFieldErrors(undefined);
                            setModal({ producto: p, tipo: "entrada" });
                          }}
                        >
                          <ArrowDownCircle size={13} /> Entrada
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setFieldErrors(undefined);
                            setModal({ producto: p, tipo: "salida" });
                          }}
                        >
                          <ArrowUpCircle size={13} /> Salida
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded === p.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="bg-muted/40 whitespace-normal py-3">
                        <div className="font-body text-xs font-medium mb-2 text-muted-foreground">Historial de movimientos</div>
                        {historialCargando && <div className="font-body text-xs text-muted-foreground">Cargando…</div>}
                        {!historialCargando && historial && historial.length === 0 && (
                          <div className="font-body text-xs text-muted-foreground">Sin movimientos registrados.</div>
                        )}
                        {!historialCargando && historial && historial.length > 0 && (
                          <div className="space-y-2">
                            {historial.map((m) => (
                              <div key={m.id} className="flex items-center justify-between gap-3 font-body text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  {m.tipo === "entrada" ? (
                                    <ArrowDownCircle size={14} className="text-primary shrink-0" />
                                  ) : (
                                    <ArrowUpCircle size={14} className="text-destructive shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-foreground truncate">
                                      {m.tipo === "entrada" ? "Entrada" : "Salida"} de {m.cantidad} {p.unidad.nombre}
                                      {m.origen === "venta" && <span className="text-muted-foreground"> · venta</span>}
                                    </div>
                                    <div className="text-muted-foreground truncate">
                                      {new Date(m.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                                      {m.usuario && <> · {m.usuario.nombre}</>}
                                      {m.motivo && <> · {m.motivo}</>}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-mono text-muted-foreground shrink-0">→ {m.stockResultante}</span>
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
            <DialogTitle>{modal?.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}</DialogTitle>
          </DialogHeader>
          {modal && (
            <MovimientoForm
              producto={modal.producto}
              tipo={modal.tipo}
              bodegas={bodegas}
              fieldErrors={fieldErrors}
              onCancel={() => setModal(null)}
              onSave={guardar}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
