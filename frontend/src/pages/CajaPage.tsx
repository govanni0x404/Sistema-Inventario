import { useEffect, useMemo, useState } from "react";
import { Search, Receipt, Minus, Plus, X } from "lucide-react";
import { productosApi } from "../api/productos";
import { clientesApi } from "../api/clientes";
import { ventasApi } from "../api/ventas";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { Cliente } from "../types/cliente";
import type { MetodoPago } from "../types/venta";
import Toast from "../components/Toast";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

type CartItem = { productoId: string; nombre: string; precio: number; cantidad: number; stockMax: number };

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export default function CajaPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant?: "success" | "error" } | null>(null);

  const notify = (text: string, variant: "success" | "error" = "success") => setToast({ text, variant });

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
      notify("Sin stock disponible", "error");
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
          notify("No hay más stock de este producto", "error");
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
      await ventasApi.crear({
        clienteId: clienteId || null,
        metodoPago,
        items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad })),
      });
      setCart([]);
      setClienteId("");
      setMetodoPago("efectivo");
      notify("Venta registrada");
      await cargar();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "No se pudo registrar la venta", "error");
      await cargar();
    } finally {
      setCobrando(false);
    }
  };

  if (loadError) {
    return (
      <div className="font-body text-sm text-center py-10 text-warn">
        {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
      </div>
    );
  }

  if (productos === null) {
    return <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando…</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
      <div className="flex-1 min-w-0">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            autoFocus
            className="w-full font-body text-sm pl-10 pr-3 py-3 rounded-xl outline-none border border-border text-ink bg-white focus:border-accent transition-colors"
            placeholder="Buscar producto por nombre o SKU..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {q.trim() && (
          <div className="space-y-2 mb-4">
            {results.length === 0 && (
              <div className="font-body text-sm text-center py-10 text-ink-soft">Sin resultados.</div>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left disabled:opacity-40"
              >
                <div>
                  <div className="font-body text-sm font-medium text-ink">{p.nombre}</div>
                  <div className="font-mono text-xs mt-0.5 text-ink-soft">
                    {p.sku} · Stock: {p.stock}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold text-accent">{money(p.precioVenta)}</div>
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
                className="rounded-xl border border-border bg-surface p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div className="font-body text-xs font-medium leading-snug text-ink">{p.nombre}</div>
                <div className="font-mono text-xs mt-2 font-semibold text-accent">{money(p.precioVenta)}</div>
              </button>
            ))}
            {rapidos.length === 0 && (
              <div className="col-span-full font-body text-sm text-center py-10 text-ink-soft">
                No hay productos con stock disponible.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:w-96 shrink-0">
        <div className="rounded-2xl p-4 font-mono bg-ink text-white">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} />
            <span className="font-display text-sm font-semibold tracking-wide">TICKET DE VENTA</span>
          </div>
          <div className="text-[11px] opacity-60 mb-3">
            {new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
          </div>

          <select
            className="w-full text-xs mb-3 rounded-md px-2 py-1.5 font-body bg-[#2A3A35] text-white border border-[#3E4E48]"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Cliente general</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <div className="border-t border-dashed pt-2 border-[#4A5A54]">
            {cart.length === 0 && (
              <div className="text-xs opacity-50 py-6 text-center font-body">Agrega productos para iniciar el ticket</div>
            )}
            {cart.map((c) => (
              <div key={c.productoId} className="py-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="truncate pr-2">{c.nombre}</span>
                  <span>{money(c.precio * c.cantidad)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 opacity-80">
                  <button onClick={() => changeQty(c.productoId, -1)} className="w-4 h-4 flex items-center justify-center rounded bg-[#2A3A35]">
                    <Minus size={10} />
                  </button>
                  <span>
                    {c.cantidad} × {money(c.precio)}
                  </span>
                  <button onClick={() => changeQty(c.productoId, 1)} className="w-4 h-4 flex items-center justify-center rounded bg-[#2A3A35]">
                    <Plus size={10} />
                  </button>
                  <button onClick={() => removeItem(c.productoId)} className="ml-auto opacity-60">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed mt-2 pt-2 border-[#4A5A54]">
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
                  className={`text-[11px] py-1.5 rounded-md capitalize ${
                    metodoPago === m ? "bg-accent text-white" : "bg-[#2A3A35] text-[#cfd8d4]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={cobrar}
              disabled={cart.length === 0 || cobrando}
              className="w-full font-body font-semibold text-sm py-2.5 rounded-lg disabled:opacity-40 bg-accent-soft text-accent-dark"
            >
              {cobrando ? "Procesando..." : `Cobrar ${cart.length > 0 ? money(total) : ""}`}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast text={toast.text} variant={toast.variant} onDone={() => setToast(null)} />}
    </div>
  );
}
