import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { toast } from "sonner";
import { Search, Receipt, Minus, Plus, X, Clock, LogOut, Printer, CheckCircle2, SplitSquareHorizontal, Send, Eraser, FilePlus2, Inbox, Banknote } from "lucide-react";
import { productosApi } from "../api/productos";
import { clientesApi } from "../api/clientes";
import { ventasApi } from "../api/ventas";
import { turnosApi } from "../api/turnos";
import { ventasEnEsperaApi } from "../api/ventasEnEspera";
import { listasPrecioApi } from "../api/listasPrecio";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { Cliente } from "../types/cliente";
import type { MetodoPago, Venta } from "../types/venta";
import type { TurnoCaja } from "../types/turno";
import type { VentaEnEspera } from "../types/ventaEnEspera";
import type { ListaPrecio } from "../types/listaPrecio";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import AbrirTurnoCard from "../components/AbrirTurnoCard";
import CerrarTurnoDialog from "../components/CerrarTurnoDialog";
import VentasEnEsperaDialog from "../components/VentasEnEsperaDialog";
import MovimientoCajaDialog from "../components/MovimientoCajaDialog";
import VueltoModal from "../components/VueltoModal";
import { printTicket } from "../lib/printTicket";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type CartItem = { productoId: string; nombre: string; precio: number; cantidad: number; stockMax: number; descuento: number };

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];
const CLIENTE_GENERAL = "__general__";
const LISTA_BASE = "__base__";

export default function CajaPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [pagos, setPagos] = useState<{ metodoPago: MetodoPago; monto: string }[]>([{ metodoPago: "efectivo", monto: "" }]);
  const [cortesia, setCortesia] = useState(false);
  const [motivoCortesia, setMotivoCortesia] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [vuelto, setVuelto] = useState<number | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [descuentoTicket, setDescuentoTicket] = useState("");
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<Venta | null>(null);
  const [mostrarEspera, setMostrarEspera] = useState(false);
  const [mostrarMovimientoCaja, setMostrarMovimientoCaja] = useState(false);
  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [referenciaEnvio, setReferenciaEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [listaPrecioId, setListaPrecioId] = useState("");
  const [overridePrecios, setOverridePrecios] = useState<Record<string, number>>({});

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
      const [p, c, l] = await Promise.all([productosApi.listar(), clientesApi.listar(), listasPrecioApi.listar(true)]);
      setProductos(p);
      setClientes(c);
      setListas(l);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargarTurno();
    cargar();
  }, []);

  useEffect(() => {
    if (!listaPrecioId) {
      setOverridePrecios({});
      return;
    }
    listasPrecioApi
      .precios(listaPrecioId)
      .then((precios) => setOverridePrecios(Object.fromEntries(precios.map((p) => [p.productoId, p.precio]))))
      .catch(() => {
        toast.error("No se pudieron cargar los precios de la lista");
        setOverridePrecios({});
      });
  }, [listaPrecioId]);

  const precioEfectivo = (p: Producto) => overridePrecios[p.id] ?? p.precioVenta;

  // Al cambiar de lista, los productos que ya están en el carrito toman el precio nuevo.
  // El backend cobra con la misma lista (listaPrecioId), así que pantalla y cobro coinciden.
  useEffect(() => {
    setCart((prev) =>
      prev.map((c) => {
        const base = productos?.find((p) => p.id === c.productoId)?.precioVenta ?? c.precio;
        const precio = overridePrecios[c.productoId] ?? base;
        return { ...c, precio, descuento: Math.min(c.descuento, precio * c.cantidad) };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overridePrecios]);

  const disponibles = useMemo(() => (productos ?? []).filter((p) => p.activo), [productos]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    return disponibles.filter((p) => (p.nombre + p.sku + (p.codigoBarras ?? "")).toLowerCase().includes(term)).slice(0, 6);
  }, [q, disponibles]);

  const rapidos = useMemo(() => disponibles.filter((p) => p.stock > 0).slice(0, 12), [disponibles]);

  // Un lector de código de barras escribe rápido y termina con Enter: si el texto coincide
  // exacto con un código de barras o SKU, se agrega directo sin requerir un clic.
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const term = q.trim();
    if (!term) return;
    const match =
      disponibles.find((p) => p.codigoBarras === term) ||
      disponibles.find((p) => p.sku.toLowerCase() === term.toLowerCase());
    if (match) {
      addToCart(match);
    } else if (results.length === 1) {
      addToCart(results[0]);
    } else {
      toast.error("Producto no encontrado");
    }
  };

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
      setCart([...cart, { productoId: p.id, nombre: p.nombre, precio: precioEfectivo(p), cantidad: 1, stockMax: p.stock, descuento: 0 }]);
    }
    setQ("");
  };

  const changeDescuentoItem = (id: string, valor: string) => {
    setCart(
      cart.map((c) => {
        if (c.productoId !== id) return c;
        const bruto = c.precio * c.cantidad;
        const num = Math.max(0, Math.min(bruto, Number(valor) || 0));
        return { ...c, descuento: valor === "" ? 0 : num };
      })
    );
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
        return { ...c, cantidad: next, descuento: Math.min(c.descuento, c.precio * next) };
      })
    );
  };
  const removeItem = (id: string) => setCart(cart.filter((c) => c.productoId !== id));

  const bruto = cart.reduce((s, c) => s + c.precio * c.cantidad, 0);
  const descuentoItems = cart.reduce((s, c) => s + c.descuento, 0);
  const subtotal = bruto - descuentoItems;
  const descuentoTicketNum = Math.max(0, Math.min(subtotal, Number(descuentoTicket) || 0));
  const total = subtotal - descuentoTicketNum;

  const dividido = pagos.length === 2;
  const sumaPagos = dividido ? pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0) : total;
  const pagosValidos = !dividido || Math.abs(sumaPagos - total) < 0.01;

  // Cuánto de la venta se paga en efectivo (para calcular el vuelto). Si no está
  // dividido y el único método es efectivo, es el total completo.
  const montoEfectivoVenta = dividido
    ? Number(pagos.find((p) => p.metodoPago === "efectivo")?.monto) || 0
    : pagos[0].metodoPago === "efectivo"
      ? total
      : 0;

  const setMetodoPago = (idx: 0 | 1, metodoPago: MetodoPago) => {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, metodoPago } : p)));
  };

  const setMontoPago = (idx: 0 | 1, valor: string) => {
    setPagos((prev) => {
      if (prev.length < 2) return prev;
      const otro = idx === 0 ? 1 : 0;
      const num = Math.max(0, Math.min(total, Number(valor) || 0));
      const siguiente = [...prev];
      siguiente[idx] = { ...siguiente[idx], monto: valor === "" ? "" : String(num) };
      siguiente[otro] = { ...siguiente[otro], monto: (total - num).toFixed(2) };
      return siguiente;
    });
  };

  const dividirPago = () => {
    setPagos((prev) => [
      { ...prev[0], monto: total.toFixed(2) },
      { metodoPago: prev[0].metodoPago === "efectivo" ? "tarjeta" : "efectivo", monto: "0.00" },
    ]);
  };

  const quitarDivision = () => setPagos((prev) => [{ ...prev[0], monto: "" }]);

  // "Venta nueva": resetea todo el ticket (carrito, cliente, formas de pago, descuento).
  const resetCompleto = () => {
    setCart([]);
    setClienteId("");
    setPagos([{ metodoPago: "efectivo", monto: "" }]);
    setDescuentoTicket("");
    setCortesia(false);
    setMotivoCortesia("");
    setMontoRecibido("");
  };

  // "Limpiar": solo vacía el carrito, mantiene cliente y forma de pago elegidos.
  const limpiarCarrito = () => {
    setCart([]);
    setDescuentoTicket("");
  };

  const enviarAEspera = async () => {
    if (cart.length === 0) return;
    setEnviando(true);
    try {
      await ventasEnEsperaApi.crear({
        referencia: referenciaEnvio.trim() || null,
        clienteId: clienteId || null,
        descuento: descuentoTicketNum,
        items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad, descuento: c.descuento })),
      });
      resetCompleto();
      setMostrarEnviar(false);
      setReferenciaEnvio("");
      toast.success("Venta enviada a espera");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo enviar la venta");
    } finally {
      setEnviando(false);
    }
  };

  const recuperarEnEspera = async (v: VentaEnEspera) => {
    setCart(
      v.items.map((it) => ({
        productoId: it.productoId,
        nombre: it.producto.nombre,
        precio: overridePrecios[it.productoId] ?? it.producto.precioVenta,
        cantidad: it.cantidad,
        stockMax: it.producto.stock,
        descuento: it.descuento,
      }))
    );
    setClienteId(v.clienteId || "");
    setDescuentoTicket(v.descuento > 0 ? String(v.descuento) : "");
    setMostrarEspera(false);
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      toast.success("Venta recuperada");
    } catch {
      toast.error("Se recuperó el carrito, pero no se pudo quitar de la lista de espera");
    }
  };

  const cobrar = async () => {
    if (cart.length === 0) return;
    if (cortesia) {
      if (!motivoCortesia.trim()) {
        toast.error("Indica el motivo de la cortesía");
        return;
      }
    } else if (!pagosValidos) {
      return;
    }
    setCobrando(true);
    try {
      const venta = await ventasApi.crear({
        clienteId: clienteId || null,
        listaPrecioId: listaPrecioId || null,
        esCortesia: cortesia,
        motivoCortesia: cortesia ? motivoCortesia.trim() : undefined,
        pagos: cortesia
          ? undefined
          : dividido
            ? pagos.map((p) => ({ metodoPago: p.metodoPago, monto: Number(p.monto) || 0 }))
            : [{ metodoPago: pagos[0].metodoPago, monto: total }],
        descuento: descuentoTicketNum,
        items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad, descuento: c.descuento })),
      });
      const cambio = !cortesia ? (Number(montoRecibido) || 0) - montoEfectivoVenta : 0;
      resetCompleto();
      toast.success(cortesia ? "Cortesía registrada" : "Venta registrada");
      setVentaCompletada(venta);
      if (cambio > 0.001) setVuelto(cambio);
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-3 rounded-xl border border-border bg-card">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMostrarEspera(true)}>
            <Inbox size={14} /> En espera
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMostrarMovimientoCaja(true)}>
            <Banknote size={14} /> Retiro/Ingreso
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMostrarCierre(true)}>
            <LogOut size={14} /> Cerrar turno
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-10 h-11 rounded-xl"
              placeholder="Buscar producto, SKU o escanear código de barras..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
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
                  <div className="font-mono text-sm font-semibold text-primary">{money(precioEfectivo(p))}</div>
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
                  <div className="font-mono text-xs mt-2 font-semibold text-primary">{money(precioEfectivo(p))}</div>
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
              <span className="font-display text-sm font-semibold tracking-wide flex-1">TICKET DE VENTA</span>
              <button
                onClick={() => setMostrarEnviar(true)}
                disabled={cart.length === 0}
                title="Enviar a espera"
                className="opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send size={13} />
              </button>
              <button
                onClick={limpiarCarrito}
                disabled={cart.length === 0}
                title="Limpiar carrito"
                className="opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <Eraser size={14} />
              </button>
              <button onClick={resetCompleto} title="Venta nueva" className="opacity-70 hover:opacity-100 cursor-pointer">
                <FilePlus2 size={14} />
              </button>
            </div>
            <div className="text-[11px] opacity-60 mb-3">
              {new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
            </div>

            <Select value={clienteId || CLIENTE_GENERAL} onValueChange={(v) => setClienteId(v === CLIENTE_GENERAL ? "" : v)}>
              <SelectTrigger className="w-full mb-2 text-xs font-body bg-zinc-900 border-zinc-700 text-zinc-50 h-8">
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

            {listas.length > 0 && (
              <Select value={listaPrecioId || LISTA_BASE} onValueChange={(v) => setListaPrecioId(v === LISTA_BASE ? "" : v)}>
                <SelectTrigger className="w-full mb-3 text-xs font-body bg-zinc-900 border-zinc-700 text-zinc-50 h-8">
                  <SelectValue placeholder="Lista de precios base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LISTA_BASE}>Lista de precios base</SelectItem>
                  {listas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="border-t border-dashed border-zinc-700 pt-2">
              {cart.length === 0 && <div className="text-xs opacity-50 py-6 text-center font-body">Agrega productos para iniciar el ticket</div>}
              {cart.map((c) => (
                <div key={c.productoId} className="py-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="truncate pr-2">{c.nombre}</span>
                    <span>
                      {c.descuento > 0 && (
                        <span className="opacity-50 line-through mr-1.5">{money(c.precio * c.cantidad)}</span>
                      )}
                      {money(c.precio * c.cantidad - c.descuento)}
                    </span>
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
                    <span className="flex items-center gap-1 ml-2">
                      <span className="opacity-60">Desc.</span>
                      <input
                        type="number"
                        min={0}
                        value={c.descuento || ""}
                        onChange={(e) => changeDescuentoItem(c.productoId, e.target.value)}
                        placeholder="0"
                        className="w-12 bg-zinc-800 rounded px-1 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                      />
                    </span>
                    <button onClick={() => removeItem(c.productoId)} className="ml-auto opacity-60 cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-zinc-700 mt-2 pt-2 space-y-1">
              {descuentoItems > 0 && (
                <div className="flex justify-between text-[11px] opacity-70">
                  <span>Subtotal</span>
                  <span>{money(bruto)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] opacity-80">
                <span>Descuento ticket</span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  value={descuentoTicket}
                  onChange={(e) => setDescuentoTicket(e.target.value)}
                  placeholder="0"
                  className="w-16 bg-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-right outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-between text-base font-semibold pt-1">
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-body opacity-80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cortesia}
                  onChange={(e) => setCortesia(e.target.checked)}
                  className="accent-primary"
                />
                Venta de cortesía (sin cobro)
              </label>

              {cortesia && (
                <Input
                  autoFocus
                  value={motivoCortesia}
                  onChange={(e) => setMotivoCortesia(e.target.value)}
                  placeholder="Motivo de la cortesía (obligatorio)"
                  className="bg-zinc-900 border-zinc-700 text-zinc-50 text-xs h-8 placeholder:text-zinc-500"
                />
              )}

              {!cortesia && pagos.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="grid grid-cols-3 gap-1.5 flex-1 font-body">
                      {METODOS.map((m) => {
                        const usadoPorElOtro = dividido && pagos[idx === 0 ? 1 : 0]?.metodoPago === m;
                        return (
                          <button
                            key={m}
                            onClick={() => setMetodoPago(idx as 0 | 1, m)}
                            disabled={usadoPorElOtro}
                            title={usadoPorElOtro ? "Ya elegiste esta forma de pago en la otra línea" : undefined}
                            className={cn(
                              "text-[11px] py-1.5 rounded-md capitalize transition-colors",
                              usadoPorElOtro
                                ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                                : p.metodoPago === m
                                  ? "bg-primary text-primary-foreground cursor-pointer"
                                  : "bg-zinc-800 text-zinc-300 cursor-pointer"
                            )}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                    {idx === 1 && (
                      <button onClick={quitarDivision} className="opacity-60 hover:opacity-100 cursor-pointer shrink-0" aria-label="Quitar segunda forma de pago">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {dividido && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="opacity-60 font-body">Monto</span>
                      <input
                        type="number"
                        min={0}
                        max={total}
                        step="0.01"
                        value={p.monto}
                        onChange={(e) => setMontoPago(idx as 0 | 1, e.target.value)}
                        className="flex-1 bg-zinc-800 rounded px-1.5 py-1 text-right outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                  )}
                </div>
              ))}

              {!cortesia && !dividido && (
                <button
                  onClick={dividirPago}
                  className="flex items-center gap-1.5 text-[11px] font-body opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <SplitSquareHorizontal size={12} /> Dividir en 2 formas de pago
                </button>
              )}
              {!cortesia && dividido && !pagosValidos && (
                <p className="text-[11px] text-amber-400 font-body">
                  Los montos deben sumar {money(total)} (van {money(sumaPagos)})
                </p>
              )}

              {!cortesia && montoEfectivoVenta > 0 && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="opacity-60 font-body shrink-0">Recibe (efectivo)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder={montoEfectivoVenta.toFixed(2)}
                    className="flex-1 bg-zinc-800 rounded px-1.5 py-1 text-right outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  {Number(montoRecibido) > montoEfectivoVenta && (
                    <span className="font-mono text-primary shrink-0">
                      Vuelto {money(Number(montoRecibido) - montoEfectivoVenta)}
                    </span>
                  )}
                </div>
              )}

              <Button
                onClick={cobrar}
                disabled={cart.length === 0 || cobrando || (cortesia ? !motivoCortesia.trim() : !pagosValidos)}
                className="w-full font-body font-semibold"
                size="lg"
                variant={cortesia ? "secondary" : "default"}
              >
                {cobrando
                  ? "Procesando..."
                  : cortesia
                    ? `Registrar cortesía${cart.length > 0 ? ` · ${money(total)}` : ""}`
                    : `Cobrar ${cart.length > 0 ? money(total) : ""}`}
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

      <VentasEnEsperaDialog open={mostrarEspera} onClose={() => setMostrarEspera(false)} onRecuperar={recuperarEnEspera} />

      <MovimientoCajaDialog open={mostrarMovimientoCaja} onClose={() => setMostrarMovimientoCaja(false)} />

      <VueltoModal vuelto={vuelto} onClose={() => setVuelto(null)} />

      <Dialog open={mostrarEnviar} onOpenChange={(o) => !o && setMostrarEnviar(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar a espera</DialogTitle>
            <DialogDescription>Guarda este carrito para retomarlo después.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Referencia (opcional)</Label>
            <Input
              autoFocus
              value={referenciaEnvio}
              onChange={(e) => setReferenciaEnvio(e.target.value)}
              placeholder="Ej. Mesa 3, nombre del cliente..."
              onKeyDown={(e) => e.key === "Enter" && enviarAEspera()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarEnviar(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarAEspera} disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
