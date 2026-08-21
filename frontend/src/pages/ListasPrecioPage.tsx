import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Copy, History } from "lucide-react";
import { listasPrecioApi } from "../api/listasPrecio";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { HistorialPrecioLista, ListaPrecio, PrecioLista } from "../types/listaPrecio";
import type { Producto } from "../types/producto";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function ListasPrecioPage() {
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [seleccionada, setSeleccionada] = useState<ListaPrecio | null>(null);
  const [nombre, setNombre] = useState("");
  const [copiarPrecios, setCopiarPrecios] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const [productos, setProductos] = useState<Producto[]>([]);
  const [precios, setPrecios] = useState<PrecioLista[] | null>(null);
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null);
  const [editPrecioValor, setEditPrecioValor] = useState("");

  const [historialProducto, setHistorialProducto] = useState<Producto | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecioLista[] | null>(null);

  const cargarListas = async () => {
    try {
      setListas(await listasPrecioApi.listar());
    } catch {
      toast.error("No se pudieron cargar las listas de precios");
    }
  };

  useEffect(() => {
    cargarListas();
    productosApi.listar().then(setProductos).catch(() => setProductos([]));
  }, []);

  const cargarPrecios = async (lista: ListaPrecio) => {
    setSeleccionada(lista);
    setPrecios(null);
    try {
      setPrecios(await listasPrecioApi.precios(lista.id));
    } catch {
      toast.error("No se pudieron cargar los precios de la lista");
    }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const nueva = await listasPrecioApi.crear({ nombre: nombre.trim(), copiarPrecios });
      setListas((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      setCopiarPrecios(false);
      toast.success("Lista de precios creada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear la lista");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (lista: ListaPrecio) => {
    try {
      const actualizada = await listasPrecioApi.actualizar(lista.id, { activo: !lista.activo });
      setListas((prev) => prev.map((l) => (l.id === actualizada.id ? actualizada : l)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar");
    }
  };

  const empezarEdicion = (lista: ListaPrecio) => {
    setEditandoId(lista.id);
    setEditNombre(lista.nombre);
  };

  const guardarEdicion = async (lista: ListaPrecio) => {
    const nuevoNombre = editNombre.trim();
    if (!nuevoNombre || nuevoNombre === lista.nombre) {
      setEditandoId(null);
      return;
    }
    try {
      const actualizada = await listasPrecioApi.actualizar(lista.id, { nombre: nuevoNombre });
      setListas((prev) => prev.map((l) => (l.id === actualizada.id ? actualizada : l)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      if (seleccionada?.id === lista.id) setSeleccionada(actualizada);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar");
    } finally {
      setEditandoId(null);
    }
  };

  const eliminar = async (lista: ListaPrecio) => {
    try {
      const resultado = await listasPrecioApi.eliminar(lista.id);
      if (resultado?._desactivado) {
        setListas((prev) => prev.map((l) => (l.id === resultado.id ? resultado : l)));
        if (seleccionada?.id === lista.id) setSeleccionada(resultado);
        toast("Esta lista ya tiene (o tuvo) precios propios: se desactivó en lugar de eliminarse");
      } else {
        setListas((prev) => prev.filter((l) => l.id !== lista.id));
        if (seleccionada?.id === lista.id) {
          setSeleccionada(null);
          setPrecios(null);
        }
        toast.success("Lista de precios eliminada");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  };

  const precioEnLista = (productoId: string) => precios?.find((p) => p.productoId === productoId);

  const verHistorial = async (producto: Producto) => {
    if (!seleccionada) return;
    setHistorialProducto(producto);
    setHistorial(null);
    try {
      setHistorial(await listasPrecioApi.historialPrecio(seleccionada.id, producto.id));
    } catch {
      toast.error("No se pudo cargar el historial de precios");
    }
  };

  const empezarEdicionPrecio = (productoId: string, valorActual: number) => {
    setEditandoPrecioId(productoId);
    setEditPrecioValor(String(valorActual));
  };

  const guardarPrecio = async (producto: Producto) => {
    if (!seleccionada) return;
    const num = Number(editPrecioValor);
    if (!editPrecioValor || isNaN(num) || num < 0) {
      setEditandoPrecioId(null);
      return;
    }
    try {
      const guardado = await listasPrecioApi.guardarPrecio(seleccionada.id, producto.id, num);
      setPrecios((prev) => {
        const sinEste = (prev ?? []).filter((p) => p.productoId !== producto.id);
        return [...sinEste, guardado];
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar el precio");
    } finally {
      setEditandoPrecioId(null);
    }
  };

  const quitarOverride = async (producto: Producto) => {
    if (!seleccionada) return;
    try {
      await listasPrecioApi.quitarPrecio(seleccionada.id, producto.id);
      setPrecios((prev) => (prev ?? []).filter((p) => p.productoId !== producto.id));
      toast.success("Vuelve a usar el precio base");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo quitar");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-display text-base">Listas de precios</CardTitle>
          <CardDescription>Ej. Público, Mayorista — se eligen al vender en Caja.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {listas.map((l) => (
              <div
                key={l.id}
                onClick={() => editandoId !== l.id && cargarPrecios(l)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  seleccionada?.id === l.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {editandoId === l.id ? (
                  <Input
                    autoFocus
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.key === "Enter" && guardarEdicion(l)}
                    onBlur={() => guardarEdicion(l)}
                    className="h-8"
                  />
                ) : (
                  <span className="font-body text-sm text-foreground">{l.nombre}</span>
                )}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {editandoId === l.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => guardarEdicion(l)} aria-label="Guardar">
                        <Check size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditandoId(null)} aria-label="Cancelar">
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Switch checked={l.activo} onCheckedChange={() => toggleActivo(l)} />
                      <Button variant="ghost" size="icon" onClick={() => empezarEdicion(l)} aria-label="Renombrar">
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(l)} aria-label="Eliminar">
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {listas.length === 0 && <div className="font-body text-xs text-muted-foreground">Aún no hay listas de precios.</div>}
          </div>

          <form onSubmit={crear} className="space-y-2">
            <Input placeholder="Nombre (ej. Mayorista)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label className="flex items-center gap-2 text-xs font-body text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={copiarPrecios} onChange={(e) => setCopiarPrecios(e.target.checked)} className="accent-primary" />
              <Copy size={12} /> Copiar los precios actuales como punto de partida
            </label>
            <Button type="submit" disabled={creando} className="w-full">
              <Plus size={16} /> Crear lista
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">{seleccionada ? `Precios — ${seleccionada.nombre}` : "Selecciona una lista"}</CardTitle>
          <CardDescription>
            {seleccionada
              ? "Un producto sin precio propio en esta lista usa su precio base."
              : "Elige una lista a la izquierda para ver y editar sus precios."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seleccionada && precios === null && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {seleccionada && precios !== null && (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Precio base</TableHead>
                    <TableHead className="text-right">Precio en esta lista</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => {
                    const override = precioEnLista(p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-body text-sm text-foreground">{p.nombre}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{money(p.precioVenta)}</TableCell>
                        <TableCell className="text-right">
                          {editandoPrecioId === p.id ? (
                            <Input
                              autoFocus
                              value={editPrecioValor}
                              onChange={(e) => setEditPrecioValor(e.target.value.replace(/[^0-9.]/g, ""))}
                              onKeyDown={(e) => e.key === "Enter" && guardarPrecio(p)}
                              onBlur={() => guardarPrecio(p)}
                              className="h-8 w-24 ml-auto text-right"
                            />
                          ) : (
                            <button
                              onClick={() => empezarEdicionPrecio(p.id, override?.precio ?? p.precioVenta)}
                              className="font-mono text-sm font-semibold text-primary cursor-pointer hover:underline"
                            >
                              {money(override?.precio ?? p.precioVenta)}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => verHistorial(p)} aria-label="Ver historial de precios" title="Historial de precios en esta lista">
                              <History size={13} />
                            </Button>
                            {override && (
                              <Button variant="ghost" size="icon" onClick={() => quitarOverride(p)} aria-label="Quitar precio propio" title="Volver al precio base">
                                <X size={13} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historialProducto} onOpenChange={(o) => !o && setHistorialProducto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de precios{historialProducto && ` — ${historialProducto.nombre}`}</DialogTitle>
          </DialogHeader>
          {historial === null && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {historial && historial.length === 0 && (
            <div className="font-body text-xs text-muted-foreground">Sin cambios registrados todavía.</div>
          )}
          {historial && historial.length > 0 && (
            <div className="space-y-2">
              {historial.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 font-body text-xs">
                  <div className="min-w-0">
                    <div className="text-foreground">
                      {h.precioAnterior === null ? "Se fijó" : h.precioNuevo === null ? "Se quitó (vuelve al precio base)" : "Se cambió"}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {new Date(h.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                      {h.usuario && <> · {h.usuario.nombre}</>}
                    </div>
                  </div>
                  <span className="font-mono text-muted-foreground shrink-0">
                    {h.precioAnterior === null ? "—" : money(h.precioAnterior)} → {h.precioNuevo === null ? "—" : money(h.precioNuevo)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
