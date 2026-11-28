import { useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { ApiError } from "@/api/client";
import { comprasApi, type CatalogoCompras, type CompraSugerida, type DetalleCompra } from "@/api/compras";
import { centavosCosto, costoEnPesos } from "@/lib/formatCosto";
import { idOperacion } from "@/lib/idOperacion";
import { matchesSearch, normalizeSearch } from "@/lib/search";
import type { Producto } from "@/types/producto";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_CANTIDAD = 2_147_483_647;
const MAX_COSTO = 99_999_999.99;
const MAX_LINEAS = 100;

type Fila = { productoId: string; nombre: string; codigo: string; cantidad: string; costo: string };
function filaProducto(producto: Producto, cantidad: number): Fila {
  return {
    productoId: producto.id, nombre: producto.nombre, codigo: producto.codigoBarras ?? "",
    cantidad: String(cantidad), costo: String(producto.precioCompra),
  };
}

export default function CompraFormDialog({ catalogo, orden, sugerida, onClose, onSave }: {
  catalogo: CatalogoCompras;
  orden?: DetalleCompra;
  sugerida?: CompraSugerida;
  onClose: () => void;
  onSave: (orden: DetalleCompra) => void;
}) {
  const { productos, proveedores, bodegas } = catalogo;
  const [id] = useState(idOperacion);
  const [proveedorId, setProveedor] = useState(orden?.proveedorId ?? sugerida?.proveedorId ?? "");
  const [bodegaId, setBodega] = useState(orden?.bodegaId ?? sugerida?.bodegaId ?? bodegas.find((b) => b.principal)?.id ?? "");
  const [entrega, setEntrega] = useState(orden?.entregaEstimada?.slice(0, 10) ?? "");
  const [nota, setNota] = useState(orden?.nota ?? "");
  const [filas, setFilas] = useState<Fila[]>(() => {
    if (orden) return orden.items.map((it) => ({
      productoId: it.productoId, nombre: it.productoNombre, codigo: it.sku,
      cantidad: String(it.cantidad), costo: it.costoUnitario,
    }));
    const producto = productos.find((p) => p.id === sugerida?.productoId);
    return producto && sugerida ? [filaProducto(producto, sugerida.cantidad)] : [];
  });
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const busqueda = normalizeSearch(q);
  const seleccionados = new Set(filas.map((fila) => fila.productoId));
  const resultados = productos.filter((p) => !seleccionados.has(p.id) && matchesSearch(busqueda, [p.nombre, p.codigoBarras])).slice(0, 10);
  const total = filas.reduce((suma, fila) => {
    if (!/^\d+(\.\d{1,2})?$/.test(fila.costo) || !/^\d+$/.test(fila.cantidad)) return suma;
    return suma + centavosCosto(fila.costo, BigInt(fila.cantidad));
  }, 0n);

  function cambiarFila(productoId: string, cambios: Partial<Fila>) {
    setFilas((actuales) => actuales.map((fila) => fila.productoId === productoId ? { ...fila, ...cambios } : fila));
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!filas.length || ocupado) return;
    if (filas.some((fila) => !/^\d+(\.\d{1,2})?$/.test(fila.costo))) {
      setError("Usa un costo válido de hasta dos decimales.");
      return;
    }
    const datos = {
      proveedorId, bodegaId, entregaEstimada: entrega || null, nota,
      items: filas.map((fila) => ({ productoId: fila.productoId, cantidad: Number(fila.cantidad), costoUnitario: Number(fila.costo) })),
    };
    setOcupado(true);
    setError("");
    try {
      const guardada = orden
        ? await comprasApi.actualizar(orden.id, orden.actualizadoEn, datos)
        : await comprasApi.crear(id, datos);
      onSave(guardada);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar el borrador.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !ocupado) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-3xl" showCloseButton={!ocupado}>
        <DialogHeader>
          <DialogTitle>{orden ? `Editar orden #${orden.folio}` : "Nueva orden de compra"}</DialogTitle>
          <DialogDescription>El borrador se puede editar hasta que se emita la orden.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">Proveedor
                <select aria-label="Proveedor" className="h-9 min-w-0 rounded-md border bg-background px-2" required value={proveedorId} onChange={(e) => setProveedor(e.target.value)}>
                  <option value="">Elige un proveedor</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">Bodega de destino
                <select aria-label="Bodega de destino" className="h-9 min-w-0 rounded-md border bg-background px-2" required value={bodegaId} onChange={(e) => setBodega(e.target.value)}>
                  <option value="">Elige una bodega</option>
                  {bodegas.filter((b) => b.activo || b.id === orden?.bodegaId).map((b) =>
                    <option key={b.id} value={b.id} disabled={!b.activo}>{b.nombre}{b.activo ? "" : " (inactiva)"}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">Entrega estimada
                <Input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">Observaciones
              <Input maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
            <section className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label="Productos de la orden">
              <label className="block text-sm font-medium" htmlFor="compra-busqueda">Agregar productos</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground" />
                <Input id="compra-busqueda" className="bg-background pl-9" placeholder="Nombre o código de barras" value={q}
                  onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
              </div>
              {q.trim() && (
                <div className="max-h-40 overflow-auto rounded-md border bg-background">
                  {resultados.length === 0 && <p className="p-2 text-sm text-muted-foreground">No hay productos disponibles que coincidan.</p>}
                  {resultados.map((producto) => (
                    <button type="button" key={producto.id} disabled={filas.length >= MAX_LINEAS}
                      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent disabled:opacity-50"
                      onClick={() => { setFilas((actuales) => [...actuales, filaProducto(producto, 1)]); setQ(""); }}>
                      <Plus size={15} className="shrink-0 text-primary" /> {producto.nombre}
                      <span className="ml-auto text-xs text-muted-foreground">{producto.codigoBarras}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            {filas.length === 0 && <p className="text-sm text-muted-foreground">Agrega al menos un producto a la orden.</p>}
            {filas.length === MAX_LINEAS && <p className="text-sm text-muted-foreground">La orden llegó al máximo de 100 productos.</p>}
            <ul className="divide-y rounded-md border empty:hidden">
              {filas.map((fila) => (
                <li key={fila.productoId} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_auto]">
                  <div className="col-span-3 self-center text-sm font-medium sm:col-span-1">
                    {fila.nombre}<span className="block break-all text-xs text-muted-foreground">{fila.codigo}</span>
                  </div>
                  <label className="grid gap-1 text-xs">Cantidad
                    <Input aria-label={`Cantidad de ${fila.nombre}`} required type="number" min={1} max={MAX_CANTIDAD} step={1}
                      value={fila.cantidad} onChange={(e) => cambiarFila(fila.productoId, { cantidad: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-xs">Costo unitario
                    <Input aria-label={`Costo unitario de ${fila.nombre}`} required type="number" min={0} max={MAX_COSTO} step="0.01"
                      value={fila.costo} onChange={(e) => cambiarFila(fila.productoId, { costo: e.target.value })} />
                  </label>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${fila.nombre}`}
                    onClick={() => setFilas((actuales) => actuales.filter((f) => f.productoId !== fila.productoId))}><Trash2 size={16} /></Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3 text-sm">
              <span>Importe de la orden</span><strong className="text-lg tabular-nums">{costoEnPesos(total)}</strong>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={!filas.length}>{ocupado ? "Guardando…" : "Guardar borrador"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
