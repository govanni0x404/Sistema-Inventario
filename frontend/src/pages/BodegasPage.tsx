import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, ShieldCheck, ArrowLeftRight } from "lucide-react";
import { bodegasApi } from "../api/bodegas";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Bodega, StockBodegaItem } from "../types/bodega";
import type { Producto } from "../types/producto";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function BodegasPage() {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [seleccionada, setSeleccionada] = useState<Bodega | null>(null);
  const [stock, setStock] = useState<StockBodegaItem[] | null>(null);

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const [transferModal, setTransferModal] = useState(false);
  const [transProducto, setTransProducto] = useState("");
  const [transDestino, setTransDestino] = useState("");
  const [transCantidad, setTransCantidad] = useState("");
  const [transMotivo, setTransMotivo] = useState("");
  const [transfiriendo, setTransfiriendo] = useState(false);

  const cargarBodegas = async () => {
    try {
      const data = await bodegasApi.listar();
      setBodegas(data);
      return data;
    } catch {
      toast.error("No se pudieron cargar las bodegas");
      return [];
    }
  };

  useEffect(() => {
    cargarBodegas().then((data) => {
      if (data.length > 0) cargarStock(data[0]);
    });
    productosApi.listar().then(setProductos).catch(() => setProductos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarStock = async (bodega: Bodega) => {
    setSeleccionada(bodega);
    setStock(null);
    try {
      setStock(await bodegasApi.stock(bodega.id));
    } catch {
      toast.error("No se pudo cargar el stock de la bodega");
    }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const nueva = await bodegasApi.crear({ nombre: nombre.trim(), direccion: direccion.trim() || undefined });
      setBodegas((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre("");
      setDireccion("");
      toast.success("Bodega creada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear la bodega");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (bodega: Bodega) => {
    try {
      const actualizada = await bodegasApi.actualizar(bodega.id, { activo: !bodega.activo });
      setBodegas((prev) => prev.map((b) => (b.id === actualizada.id ? actualizada : b)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo actualizar");
    }
  };

  const empezarEdicion = (bodega: Bodega) => {
    setEditandoId(bodega.id);
    setEditNombre(bodega.nombre);
  };

  const guardarEdicion = async (bodega: Bodega) => {
    const nuevoNombre = editNombre.trim();
    if (!nuevoNombre || nuevoNombre === bodega.nombre) {
      setEditandoId(null);
      return;
    }
    try {
      const actualizada = await bodegasApi.actualizar(bodega.id, { nombre: nuevoNombre });
      setBodegas((prev) => prev.map((b) => (b.id === actualizada.id ? actualizada : b)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      if (seleccionada?.id === bodega.id) setSeleccionada(actualizada);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo renombrar");
    } finally {
      setEditandoId(null);
    }
  };

  const eliminar = async (bodega: Bodega) => {
    try {
      await bodegasApi.eliminar(bodega.id);
      setBodegas((prev) => prev.filter((b) => b.id !== bodega.id));
      if (seleccionada?.id === bodega.id) {
        setSeleccionada(null);
        setStock(null);
      }
      toast.success("Bodega eliminada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  };

  const abrirTransferencia = (productoId?: string) => {
    setTransProducto(productoId || "");
    setTransDestino("");
    setTransCantidad("");
    setTransMotivo("");
    setTransferModal(true);
  };

  const transferir = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionada || !transProducto || !transDestino || !transCantidad) return;
    setTransfiriendo(true);
    try {
      await bodegasApi.transferir({
        origenBodegaId: seleccionada.id,
        destinoBodegaId: transDestino,
        productoId: transProducto,
        cantidad: Number(transCantidad),
        motivo: transMotivo.trim() || undefined,
      });
      toast.success("Transferencia registrada");
      setTransferModal(false);
      await cargarStock(seleccionada);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo transferir el stock");
    } finally {
      setTransfiriendo(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-display text-base">Bodegas</CardTitle>
          <CardDescription>
            La bodega <strong className="text-foreground">principal</strong> es protegida: ahí ocurren las ventas de
            Caja y no se puede renombrar, desactivar ni eliminar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {bodegas.map((b) => (
              <div
                key={b.id}
                onClick={() => editandoId !== b.id && cargarStock(b)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  seleccionada?.id === b.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {editandoId === b.id ? (
                  <Input
                    autoFocus
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.key === "Enter" && guardarEdicion(b)}
                    onBlur={() => guardarEdicion(b)}
                    className="h-8"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="font-body text-sm text-foreground truncate">{b.nombre}</div>
                    {b.direccion && <div className="font-body text-xs text-muted-foreground truncate">{b.direccion}</div>}
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {b.principal ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck size={12} /> Principal
                    </Badge>
                  ) : editandoId === b.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => guardarEdicion(b)} aria-label="Guardar">
                        <Check size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditandoId(null)} aria-label="Cancelar">
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Switch checked={b.activo} onCheckedChange={() => toggleActivo(b)} />
                      <Button variant="ghost" size="icon" onClick={() => empezarEdicion(b)} aria-label="Renombrar">
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => eliminar(b)} aria-label="Eliminar">
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {bodegas.length === 0 && <div className="font-body text-xs text-muted-foreground">Aún no hay bodegas.</div>}
          </div>

          <form onSubmit={crear} className="space-y-2">
            <Input placeholder="Nombre (ej. Bodega Sucursal 2)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Input placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <Button type="submit" disabled={creando} className="w-full">
              <Plus size={16} /> Crear bodega
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="font-display text-base">{seleccionada ? `Stock — ${seleccionada.nombre}` : "Selecciona una bodega"}</CardTitle>
            <CardDescription>
              {seleccionada ? "Cantidad disponible en esta bodega, por producto." : "Elige una bodega a la izquierda para ver su stock."}
            </CardDescription>
          </div>
          {seleccionada && bodegas.length > 1 && (
            <Button size="sm" variant="secondary" onClick={() => abrirTransferencia()}>
              <ArrowLeftRight size={14} /> Transferir stock
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {seleccionada && stock === null && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {seleccionada && stock !== null && stock.length === 0 && (
            <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay productos.</div>
          )}
          {seleccionada && stock !== null && stock.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    {bodegas.length > 1 && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-body text-sm font-medium text-foreground">{s.producto.nombre}</div>
                        <div className="font-mono text-xs text-muted-foreground">{s.producto.sku}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-foreground">
                        {s.cantidad} {s.producto.unidad.nombre}
                      </TableCell>
                      {bodegas.length > 1 && (
                        <TableCell>
                          {s.cantidad > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirTransferencia(s.productoId)}
                              aria-label="Transferir"
                              title="Transferir a otra bodega"
                            >
                              <ArrowLeftRight size={13} />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir stock{seleccionada && ` desde ${seleccionada.nombre}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={transferir} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <Select value={transProducto} onValueChange={setTransProducto}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bodega destino</Label>
              <Select value={transDestino} onValueChange={setTransDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una bodega" />
                </SelectTrigger>
                <SelectContent>
                  {bodegas
                    .filter((b) => b.id !== seleccionada?.id)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                value={transCantidad}
                onChange={(e) => setTransCantidad(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Input value={transMotivo} onChange={(e) => setTransMotivo(e.target.value)} placeholder="Reabastecimiento, reorganización..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={transfiriendo || !transProducto || !transDestino || !transCantidad}>
                {transfiriendo ? "Transfiriendo..." : "Transferir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
