import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Pencil, Trash2, X, ShoppingCart, Package,
  Users, Truck, Receipt, AlertTriangle, Minus, Check
} from "lucide-react";

const C = {
  bg: "#F5F6F3",
  surface: "#FFFFFF",
  ink: "#1E2A26",
  inkSoft: "#4A5551",
  accent: "#2F6F5E",
  accentDark: "#204A3F",
  accentSoft: "#E4EFEC",
  warn: "#B54A2C",
  warnSoft: "#F6E4DD",
  border: "#E1E4E0",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.font-display{font-family:'Space Grotesk',sans-serif;}
.font-body{font-family:'Inter',sans-serif;}
.font-mono{font-family:'IBM Plex Mono',monospace;}
`;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const seedProductos = () => [
  { id: uid(), sku: "AB-001", nombre: "Arroz 1kg", categoria: "Abarrotes", precioCompra: 18, precioVenta: 25, stock: 40, stockMinimo: 10, unidad: "pieza", proveedorId: "" },
  { id: uid(), sku: "AB-002", nombre: "Frijol 1kg", categoria: "Abarrotes", precioCompra: 22, precioVenta: 30, stock: 8, stockMinimo: 10, unidad: "pieza", proveedorId: "" },
  { id: uid(), sku: "BE-001", nombre: "Refresco 600ml", categoria: "Bebidas", precioCompra: 12, precioVenta: 18, stock: 60, stockMinimo: 15, unidad: "pieza", proveedorId: "" },
  { id: uid(), sku: "BE-002", nombre: "Agua 1L", categoria: "Bebidas", precioCompra: 8, precioVenta: 12, stock: 5, stockMinimo: 12, unidad: "pieza", proveedorId: "" },
  { id: uid(), sku: "LI-001", nombre: "Jabón de trastes", categoria: "Limpieza", precioCompra: 15, precioVenta: 22, stock: 25, stockMinimo: 8, unidad: "pieza", proveedorId: "" },
];
const seedClientes = () => [
  { id: uid(), nombre: "Mostrador general", telefono: "", email: "", direccion: "" },
  { id: uid(), nombre: "María López", telefono: "555-201-3344", email: "maria@example.com", direccion: "Av. Reforma 120" },
];
const seedProveedores = () => [
  { id: uid(), nombre: "Distribuidora del Centro", telefono: "555-900-1122", email: "ventas@distcentro.com", contacto: "Jorge Ramírez" },
];

function useStorage(key, seedFn) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(key, false);
        setData(res ? JSON.parse(res.value) : seedFn());
      } catch {
        setData(seedFn());
      }
    })();
  }, [key]);
  const persist = async (next) => {
    setData(next);
    try { await window.storage.set(key, JSON.stringify(next), false); } catch {}
  };
  return [data, persist];
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function Toast({ text, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 font-body text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2"
      style={{ background: C.ink, color: "#fff" }}>
      <Check size={16} /> {text}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(30,42,38,0.45)" }} onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:opacity-70" style={{ color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block font-body text-xs font-medium mb-1" style={{ color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full font-body text-sm px-3 py-2 rounded-lg outline-none border transition-colors";
const inputStyle = { borderColor: C.border, color: C.ink, background: "#fff" };

function EntityForm({ fields, initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.type === "select" ? (
            <select className={inputCls} style={inputStyle} value={form[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">— Sin asignar —</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              className={inputCls} style={inputStyle}
              type={f.type || "text"}
              value={form[f.key] ?? ""}
              onChange={(e) => set(f.key, f.type === "number" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
              placeholder={f.placeholder || ""}
            />
          )}
        </Field>
      ))}
      <div className="flex gap-2 mt-5">
        <button onClick={onCancel} className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg border" style={{ borderColor: C.border, color: C.inkSoft }}>
          Cancelar
        </button>
        <button onClick={() => onSave(form)} className="flex-1 font-body text-sm font-medium py-2.5 rounded-lg text-white" style={{ background: C.accent }}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, vertical }) {
  if (vertical) {
    return (
      <button onClick={onClick}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl font-body text-sm font-medium transition-colors text-left"
        style={active ? { background: C.accentSoft, color: C.accentDark } : { background: "transparent", color: C.inkSoft }}>
        <Icon size={17} /> {label}
      </button>
    );
  }
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-body text-sm font-medium whitespace-nowrap transition-colors shrink-0"
      style={active ? { background: C.accent, color: "#fff" } : { background: "transparent", color: C.inkSoft }}>
      <Icon size={15} /> {label}
    </button>
  );
}

function EmptyState({ text }) {
  return <div className="font-body text-sm text-center py-10" style={{ color: C.inkSoft }}>{text}</div>;
}

// ---------- PRODUCTOS ----------
function ProductosView({ productos, setProductos, proveedores, notify }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {mode:'new'|'edit', data}

  const filtered = productos.filter((p) =>
    (p.nombre + p.sku + p.categoria).toLowerCase().includes(q.toLowerCase())
  );

  const fields = [
    { key: "sku", label: "SKU" },
    { key: "nombre", label: "Nombre" },
    { key: "categoria", label: "Categoría" },
    { key: "precioCompra", label: "Precio de compra", type: "number" },
    { key: "precioVenta", label: "Precio de venta", type: "number" },
    { key: "stock", label: "Stock actual", type: "number" },
    { key: "stockMinimo", label: "Stock mínimo", type: "number" },
    { key: "unidad", label: "Unidad", placeholder: "pieza, kg, caja..." },
    { key: "proveedorId", label: "Proveedor", type: "select", options: proveedores.map((p) => ({ value: p.id, label: p.nombre })) },
  ];

  const save = (form) => {
    const clean = { ...form, precioCompra: +form.precioCompra || 0, precioVenta: +form.precioVenta || 0, stock: +form.stock || 0, stockMinimo: +form.stockMinimo || 0 };
    if (modal.mode === "new") {
      setProductos([...productos, { ...clean, id: uid() }]);
      notify("Producto creado");
    } else {
      setProductos(productos.map((p) => (p.id === modal.data.id ? { ...p, ...clean } : p)));
      notify("Producto actualizado");
    }
    setModal(null);
  };

  const remove = (id) => { setProductos(productos.filter((p) => p.id !== id)); notify("Producto eliminado"); };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }} />
          <input className={inputCls + " pl-9"} style={inputStyle} placeholder="Buscar por nombre, SKU o categoría"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setModal({ mode: "new", data: {} })}
          className="flex items-center gap-1 font-body text-sm font-medium px-3.5 py-2 rounded-lg text-white shrink-0" style={{ background: C.accent }}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {filtered.length === 0 ? <EmptyState text="No hay productos que coincidan." /> : (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const low = p.stock <= p.stockMinimo;
            return (
              <div key={p.id} className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: C.border, background: C.surface }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-medium text-sm" style={{ color: C.ink }}>{p.nombre}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.inkSoft }}>{p.sku}</span>
                    {low && (
                      <span className="flex items-center gap-1 font-body text-xs px-1.5 py-0.5 rounded" style={{ background: C.warnSoft, color: C.warn }}>
                        <AlertTriangle size={11} /> Stock bajo
                      </span>
                    )}
                  </div>
                  <div className="font-body text-xs mt-0.5" style={{ color: C.inkSoft }}>
                    {p.categoria || "Sin categoría"} · Stock: <span className="font-mono">{p.stock}</span> {p.unidad}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold shrink-0" style={{ color: C.accent }}>{money(p.precioVenta)}</div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal({ mode: "edit", data: p })} className="p-1.5 rounded-lg" style={{ color: C.inkSoft }}><Pencil size={15} /></button>
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg" style={{ color: C.warn }}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "new" ? "Nuevo producto" : "Editar producto"} onClose={() => setModal(null)}>
          <EntityForm fields={fields} initial={modal.data} onCancel={() => setModal(null)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

// ---------- CLIENTES / PROVEEDORES (genérico) ----------
function SimpleCrudView({ items, setItems, fields, notify, labelSingular, subtitleKeys }) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const filtered = items.filter((i) => (i.nombre || "").toLowerCase().includes(q.toLowerCase()));

  const save = (form) => {
    if (modal.mode === "new") { setItems([...items, { ...form, id: uid() }]); notify(`${labelSingular} creado`); }
    else { setItems(items.map((i) => (i.id === modal.data.id ? { ...i, ...form } : i))); notify(`${labelSingular} actualizado`); }
    setModal(null);
  };
  const remove = (id) => { setItems(items.filter((i) => i.id !== id)); notify(`${labelSingular} eliminado`); };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }} />
          <input className={inputCls + " pl-9"} style={inputStyle} placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setModal({ mode: "new", data: {} })}
          className="flex items-center gap-1 font-body text-sm font-medium px-3.5 py-2 rounded-lg text-white shrink-0" style={{ background: C.accent }}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {filtered.length === 0 ? <EmptyState text={`No hay ${labelSingular.toLowerCase()}s registrados.`} /> : (
        <div className="space-y-2.5">
          {filtered.map((i) => (
            <div key={i.id} className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: C.border, background: C.surface }}>
              <div className="flex-1 min-w-0">
                <div className="font-body font-medium text-sm" style={{ color: C.ink }}>{i.nombre}</div>
                <div className="font-body text-xs mt-0.5 truncate" style={{ color: C.inkSoft }}>
                  {subtitleKeys.map((k) => i[k]).filter(Boolean).join(" · ") || "Sin datos adicionales"}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setModal({ mode: "edit", data: i })} className="p-1.5 rounded-lg" style={{ color: C.inkSoft }}><Pencil size={15} /></button>
                <button onClick={() => remove(i.id)} className="p-1.5 rounded-lg" style={{ color: C.warn }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "new" ? `Nuevo ${labelSingular.toLowerCase()}` : `Editar ${labelSingular.toLowerCase()}`} onClose={() => setModal(null)}>
          <EntityForm fields={fields} initial={modal.data} onCancel={() => setModal(null)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

// ---------- CAJA ----------
function CajaView({ productos, setProductos, clientes, ventas, setVentas, notify }) {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");

  const results = q.trim()
    ? productos.filter((p) => p.activo !== false && (p.nombre + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  const addToCart = (p) => {
    const enCarrito = cart.find((c) => c.productoId === p.id);
    const disponible = p.stock - (enCarrito ? enCarrito.cantidad : 0);
    if (disponible <= 0) { notify("Sin stock disponible"); return; }
    if (enCarrito) {
      setCart(cart.map((c) => (c.productoId === p.id ? { ...c, cantidad: c.cantidad + 1 } : c)));
    } else {
      setCart([...cart, { productoId: p.id, nombre: p.nombre, precio: p.precioVenta, cantidad: 1, stockMax: p.stock }]);
    }
    setQ("");
  };

  const changeQty = (id, delta) => {
    setCart(cart.map((c) => {
      if (c.productoId !== id) return c;
      const next = c.cantidad + delta;
      if (next <= 0) return c;
      if (next > c.stockMax) { notify("No hay más stock de este producto"); return c; }
      return { ...c, cantidad: next };
    }));
  };
  const removeItem = (id) => setCart(cart.filter((c) => c.productoId !== id));

  const total = cart.reduce((s, c) => s + c.precio * c.cantidad, 0);

  const cobrar = () => {
    if (cart.length === 0) return;
    const nuevaVenta = {
      id: uid(),
      fecha: new Date().toISOString(),
      clienteId: clienteId || null,
      items: cart.map((c) => ({ productoId: c.productoId, nombre: c.nombre, cantidad: c.cantidad, precioUnitario: c.precio, subtotal: c.precio * c.cantidad })),
      total,
      metodoPago,
    };
    setVentas([nuevaVenta, ...ventas]);
    setProductos(productos.map((p) => {
      const item = cart.find((c) => c.productoId === p.id);
      return item ? { ...p, stock: p.stock - item.cantidad } : p;
    }));
    setCart([]); setClienteId(""); setMetodoPago("efectivo");
    notify("Venta registrada");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
      <div className="flex-1 min-w-0">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }} />
          <input autoFocus className={inputCls + " pl-10 py-3 rounded-xl"} style={inputStyle} placeholder="Buscar producto por nombre o SKU..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {q.trim() && (
          <div className="space-y-2 mb-4">
            {results.length === 0 && <EmptyState text="Sin resultados." />}
            {results.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0}
                className="w-full flex items-center justify-between rounded-xl border p-4 text-left disabled:opacity-40"
                style={{ borderColor: C.border, background: C.surface }}>
                <div>
                  <div className="font-body text-sm font-medium" style={{ color: C.ink }}>{p.nombre}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: C.inkSoft }}>{p.sku} · Stock: {p.stock}</div>
                </div>
                <div className="font-mono text-sm font-semibold" style={{ color: C.accent }}>{money(p.precioVenta)}</div>
              </button>
            ))}
          </div>
        )}
        {!q.trim() && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {productos.filter((p) => p.stock > 0).slice(0, 12).map((p) => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="rounded-xl border p-4 text-left transition-shadow hover:shadow-sm" style={{ borderColor: C.border, background: C.surface }}>
                <div className="font-body text-xs font-medium leading-snug" style={{ color: C.ink }}>{p.nombre}</div>
                <div className="font-mono text-xs mt-2 font-semibold" style={{ color: C.accent }}>{money(p.precioVenta)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket estilo recibo — elemento distintivo */}
      <div className="lg:w-96 shrink-0">
        <div className="rounded-2xl p-4 font-mono" style={{ background: C.ink, color: "#fff" }}>
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} />
            <span className="font-display text-sm font-semibold tracking-wide">TICKET DE VENTA</span>
          </div>
          <div className="text-[11px] opacity-60 mb-3">{new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</div>

          <select className="w-full text-xs mb-3 rounded-md px-2 py-1.5 font-body" style={{ background: "#2A3A35", color: "#fff", border: "1px solid #3E4E48" }}
            value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Cliente general</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          <div className="border-t border-dashed pt-2" style={{ borderColor: "#4A5A54" }}>
            {cart.length === 0 && <div className="text-xs opacity-50 py-6 text-center font-body">Agrega productos para iniciar el ticket</div>}
            {cart.map((c) => (
              <div key={c.productoId} className="py-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="truncate pr-2">{c.nombre}</span>
                  <span>{money(c.precio * c.cantidad)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 opacity-80">
                  <button onClick={() => changeQty(c.productoId, -1)} className="w-4 h-4 flex items-center justify-center rounded" style={{ background: "#2A3A35" }}><Minus size={10} /></button>
                  <span>{c.cantidad} × {money(c.precio)}</span>
                  <button onClick={() => changeQty(c.productoId, 1)} className="w-4 h-4 flex items-center justify-center rounded" style={{ background: "#2A3A35" }}><Plus size={10} /></button>
                  <button onClick={() => removeItem(c.productoId)} className="ml-auto opacity-60"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed mt-2 pt-2" style={{ borderColor: "#4A5A54" }}>
            <div className="flex justify-between text-base font-semibold">
              <span>TOTAL</span><span>{money(total)}</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-3 gap-1.5 mb-2 font-body">
              {["efectivo", "tarjeta", "transferencia"].map((m) => (
                <button key={m} onClick={() => setMetodoPago(m)}
                  className="text-[11px] py-1.5 rounded-md capitalize"
                  style={metodoPago === m ? { background: C.accent, color: "#fff" } : { background: "#2A3A35", color: "#cfd8d4" }}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={cobrar} disabled={cart.length === 0}
              className="w-full font-body font-semibold text-sm py-2.5 rounded-lg disabled:opacity-40"
              style={{ background: C.accentSoft, color: C.accentDark }}>
              Cobrar {cart.length > 0 && money(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- HISTORIAL ----------
function HistorialView({ ventas, clientes }) {
  const [open, setOpen] = useState(null);
  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre || "Cliente general";
  if (ventas.length === 0) return <EmptyState text="Aún no hay ventas registradas." />;
  return (
    <div className="space-y-2.5">
      {ventas.map((v) => (
        <div key={v.id} className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
          <button onClick={() => setOpen(open === v.id ? null : v.id)} className="w-full flex items-center justify-between p-3 text-left">
            <div>
              <div className="font-body text-sm font-medium" style={{ color: C.ink }}>{nombreCliente(v.clienteId)}</div>
              <div className="font-body text-xs" style={{ color: C.inkSoft }}>
                {new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · {v.metodoPago}
              </div>
            </div>
            <div className="font-mono text-sm font-semibold" style={{ color: C.accent }}>{money(v.total)}</div>
          </button>
          {open === v.id && (
            <div className="px-3 pb-3 font-mono text-xs" style={{ color: C.inkSoft }}>
              {v.items.map((it, idx) => (
                <div key={idx} className="flex justify-between py-0.5 border-t" style={{ borderColor: C.border }}>
                  <span>{it.nombre} × {it.cantidad}</span>
                  <span>{money(it.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- APP ----------
export default function App() {
  const [productos, setProductos] = useStorage("mock_productos", seedProductos);
  const [clientes, setClientes] = useStorage("mock_clientes", seedClientes);
  const [proveedores, setProveedores] = useStorage("mock_proveedores", seedProveedores);
  const [ventas, setVentas] = useStorage("mock_ventas", () => []);
  const [tab, setTab] = useState("caja");
  const [toast, setToast] = useState(null);
  const notify = (t) => setToast(t);

  const ready = productos && clientes && proveedores && ventas;

  const lowStockCount = useMemo(() => ready ? productos.filter((p) => p.stock <= p.stockMinimo).length : 0, [productos, ready]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center font-body" style={{ background: C.bg, color: C.inkSoft }}>Cargando…</div>;
  }

  const tabs = [
    { id: "caja", label: "Caja", icon: ShoppingCart },
    { id: "productos", label: "Productos", icon: Package },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "proveedores", label: "Proveedores", icon: Truck },
    { id: "historial", label: "Historial", icon: Receipt },
  ];

  return (
    <div className="min-h-screen font-body flex" style={{ background: C.bg }}>
      <style>{FONTS}</style>

      {/* Sidebar — escritorio */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r px-4 py-6" style={{ borderColor: C.border }}>
        <h1 className="font-display text-xl font-bold px-1 mb-0.5" style={{ color: C.ink }}>Caja &amp; Inventario</h1>
        <p className="font-body text-xs px-1 mb-6" style={{ color: C.inkSoft }}>Mockup local</p>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => <TabButton key={t.id} vertical active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
        </nav>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 font-body text-xs px-3 py-2 rounded-xl mt-auto" style={{ background: C.warnSoft, color: C.warn }}>
            <AlertTriangle size={13} /> {lowStockCount} producto{lowStockCount > 1 ? "s" : ""} con stock bajo
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 sm:pt-9 pb-20">
          {/* Encabezado — móvil */}
          <div className="md:hidden flex items-center justify-between mb-1">
            <h1 className="font-display text-2xl font-bold" style={{ color: C.ink }}>Caja &amp; Inventario</h1>
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1 font-body text-xs px-2.5 py-1 rounded-full shrink-0" style={{ background: C.warnSoft, color: C.warn }}>
                <AlertTriangle size={12} /> {lowStockCount}
              </div>
            )}
          </div>
          <p className="md:hidden font-body text-sm mb-5" style={{ color: C.inkSoft }}>Datos guardados solo en este navegador.</p>

          {/* Tabs — móvil */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: "none" }}>
            {tabs.map((t) => <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
          </div>

          <h2 className="hidden md:block font-display text-2xl font-bold mb-6" style={{ color: C.ink }}>
            {tabs.find((t) => t.id === tab)?.label}
          </h2>

          <div className="rounded-2xl p-5 sm:p-7" style={{ background: tab === "caja" ? "transparent" : C.surface, border: tab === "caja" ? "none" : `1px solid ${C.border}` }}>
            {tab === "caja" && <CajaView productos={productos} setProductos={setProductos} clientes={clientes} ventas={ventas} setVentas={setVentas} notify={notify} />}
            {tab === "productos" && <ProductosView productos={productos} setProductos={setProductos} proveedores={proveedores} notify={notify} />}
            {tab === "clientes" && (
              <SimpleCrudView items={clientes} setItems={setClientes} notify={notify} labelSingular="Cliente" subtitleKeys={["telefono", "email", "direccion"]}
                fields={[{ key: "nombre", label: "Nombre" }, { key: "telefono", label: "Teléfono" }, { key: "email", label: "Correo" }, { key: "direccion", label: "Dirección" }]} />
            )}
            {tab === "proveedores" && (
              <SimpleCrudView items={proveedores} setItems={setProveedores} notify={notify} labelSingular="Proveedor" subtitleKeys={["contacto", "telefono", "email"]}
                fields={[{ key: "nombre", label: "Nombre" }, { key: "contacto", label: "Persona de contacto" }, { key: "telefono", label: "Teléfono" }, { key: "email", label: "Correo" }]} />
            )}
            {tab === "historial" && <HistorialView ventas={ventas} clientes={clientes} />}
          </div>
        </div>
      </div>
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
