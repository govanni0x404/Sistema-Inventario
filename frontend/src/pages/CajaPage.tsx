import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Receipt, Minus, Plus, X, Clock, LogOut, Printer, CheckCircle2 } from "lucide-react";
import { productosApi } from "../api/productos";
import { clientesApi } from "../api/clientes";
import { ventasApi } from "../api/ventas";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { Cliente } from "../types/cliente";
import type { MetodoPago, Venta } from "../types/venta";
import type { TurnoCaja } from "../types/turno";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import AbrirTurnoCard from "../components/AbrirTurnoCard";
import CerrarTurnoDialog from "../components/CerrarTurnoDialog";
import { printTicket } from "../lib/printTicket";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type CartItem = { productoId: string; nombre: string; precio: number; cantidad: number; stockMax: number };

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];
const CLIENTE_GENERAL = "__general__";

export default function CajaPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<Venta | null>(null);

  const cargarTurno = async () => {
    try {
      setTurno(await turnosApi.actual());
    } catch {
      setTurno(null);
    }
  };

  const cargar = async () => {
    try {
      setLoadError(null);
      const [p, c] = await Promise.all([productosApi.listar(), clientesApi.listar()]);
      setProductos(p);
      setClientes(c);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargarTurno();
    cargar();
  }, []);

  const disponibles = useMemo(() => (productos ?? []).filter((p) => p.activo), [productos]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    return disponibles.filter((p) => (p.nombre + p.sku).toLowerCase().includes(term)).slice(0, 6);
  }, [q, disponibles]);

  const rapidos = useMemo(() => disponibles.filter((p) => p.stock > 0).slice(0, 12), [disponibles]);

  const addToCart = (p: Producto) => {
    const enCarrito = cart.find((c) => c.productoId === p.id);
    const disponible = p.stock - (enCarrito ? enCarrito.cantidad : 0);
    if (disponible <= 0) {
      toast.error("Sin stock disponible");
      return;
    }
    if (enCarrito) {
      setCart(cart.map((c) => (c.productoId === p.id ? { ...c, cantidad: c.cantidad + 1 } : c)));
    } else {
      setCart([...cart, { productoId: p.id, nombre: p.nombre, precio: p.precioVenta, cantidad: 1, stockMax: p.stock }]);
    }
    setQ("");
  };

  const changeQty = (id: string, delta: number) => {
    setCart(
      cart.map((c) => {
        if (c.productoId !== id) return c;
        const next = c.cantidad + delta;
        if (next <= 0) return c;
        if (next > c.stockMax) {
          toast.error("No hay más stock de este producto");
          return c;
        }
        return { ...c, cantidad: next };
      })
    );
  };
  const removeItem = (id: string) => setCart(cart.filter((c) => c.productoId !== id));

  const total = cart.reduce((s, c) => s + c.precio * c.cantidad, 0);

  const cobrar = async () => {
    if (cart.length === 0) return;
    setCobrando(true);
    try {
      const venta = await ventasApi.crear({
        clienteId: clienteId || null,
        metodoPago,
        items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad })),
      });
      setCart([]);
      setClienteId("");
      setMetodoPago("efectivo");
      toast.success("Venta registrada");
      setVentaCompletada(venta);
      await cargar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo registrar la venta");
      await cargar();
      await cargarTurno();
    } finally {
      setCobrando(false);
    }
  };

  if (loadError) {
    return (
      <div className="font-body text-sm text-center py-10 text-destructive">
        {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
      </div>
    );
  }

  if (productos === null || turno === undefined) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (turno === null) {
    return <AbrirTurnoCard onAbierto={(t) => setTurno(t)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
            <Clock size={15} />
          </span>
          <div className="min-w-0">
            <div className="font-body text-sm font-medium text-foreground truncate">{turno.tipoTurno.nombre}</div>
            <div className="font-body text-xs text-muted-foreground truncate">
              Abierto {new Date(turno.fechaApertura).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
              {turno.usuarioApertura && ` · ${turno.usuarioApertura.nombre}`}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMostrarCierre(true)}>
          <LogOut size={14} /> Cerrar turno
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-10 h-11 rounded-xl"
              placeholder="Buscar producto por nombre o SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {q.trim() && (
            <div className="space-y-2 mb-4">
              {results.length === 0 && <div className="font-body text-sm text-center py-10 text-muted-foreground">Sin resultados.</div>}
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left disabled:opacity-40 hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="font-body text-sm font-medium text-foreground">{p.nombre}</div>
                    <div className="font-mono text-xs mt-0.5 text-muted-foreground">
                      {p.sku} · Stock: {p.stock}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-primary">{money(p.precioVenta)}</div>
                </button>
              ))}
            </div>
          )}

          {!q.trim() && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {rapidos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/40"
                >
                  <div className="font-body text-xs font-medium leading-snug text-foreground">{p.nombre}</div>
                  <div className="font-mono text-xs mt-2 font-semibold text-primary">{money(p.precioVenta)}</div>
                </button>
              ))}
              {rapidos.length === 0 && (
                <div className="col-span-full font-body text-sm text-center py-10 text-muted-foreground">
                  No hay productos con stock disponible.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:w-96 shrink-0">
          <div className="rounded-2xl p-4 font-mono bg-zinc-950 text-zinc-50 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={16} />
              <span className="font-display text-sm font-semibold tracking-wide">TICKET DE VENTA</span>
            </div>
            <div className="text-[11px] opacity-60 mb-3">
              {new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
            </div>

            <Select value={clienteId || CLIENTE_GENERAL} onValueChange={(v) => setClienteId(v === CLIENTE_GENERAL ? "" : v)}>
              <SelectTrigger className="w-full mb-3 text-xs font-body bg-zinc-900 border-zinc-700 text-zinc-50 h-8">
                <SelectValue placeholder="Cliente general" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLIENTE_GENERAL}>Cliente general</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="border-t border-dashed border-zinc-700 pt-2">
              {cart.length === 0 && <div className="text-xs opacity-50 py-6 text-center font-body">Agrega productos para iniciar el ticket</div>}
              {cart.map((c) => (
                <div key={c.productoId} className="py-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="truncate pr-2">{c.nombre}</span>
                    <span>{money(c.precio * c.cantidad)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 opacity-80">
                    <button onClick={() => changeQty(c.productoId, -1)} className="w-4 h-4 flex items-center justify-center rounded bg-zinc-800 cursor-pointer">
                      <Minus size={10} />
                    </button>
                    <span>
                      {c.cantidad} × {money(c.precio)}
                    </span>
                    <button onClick={() => changeQty(c.productoId, 1)} className="w-4 h-4 flex items-center justify-center rounded bg-zinc-800 cursor-pointer">
                      <Plus size={10} />
                    </button>
                    <button onClick={() => removeItem(c.productoId)} className="ml-auto opacity-60 cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-zinc-700 mt-2 pt-2">
              <div className="flex justify-between text-base font-semibold">
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="grid grid-cols-3 gap-1.5 mb-2 font-body">
                {METODOS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetodoPago(m)}
                    className={cn(
                      "text-[11px] py-1.5 rounded-md capitalize cursor-pointer transition-colors",
                      metodoPago === m ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Button
                onClick={cobrar}
                disabled={cart.length === 0 || cobrando}
                className="w-full font-body font-semibold"
                size="lg"
              >
                {cobrando ? "Procesando..." : `Cobrar ${cart.length > 0 ? money(total) : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {mostrarCierre && (
        <CerrarTurnoDialog
          turno={turno}
          onClose={() => setMostrarCierre(false)}
          onCerrado={() => {
            setMostrarCierre(false);
            setTurno(null);
          }}
        />
      )}

      <Dialog open={!!ventaCompletada} onOpenChange={(o) => !o && setVentaCompletada(null)}>
        <DialogContent className="sm:max-w-sm">
          {ventaCompletada && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <DialogTitle>Venta registrada</DialogTitle>
                    <DialogDescription>Total {money(ventaCompletada.total)}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVentaCompletada(null)}>
                  Nueva venta
                </Button>
                <Button onClick={() => printTicket(ventaCompletada)}>
                  <Printer size={15} /> Imprimir ticket
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
