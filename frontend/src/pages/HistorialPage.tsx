import { useEffect, useState } from "react";
import { ventasApi } from "../api/ventas";
import { clientesApi } from "../api/clientes";
import { ApiError } from "../api/client";
import type { Venta, MetodoPago } from "../types/venta";
import type { Cliente } from "../types/cliente";
import VentaDetalleModal from "../components/VentaDetalleModal";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export default function HistorialPage() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [fecha, setFecha] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("");

  const cargar = async () => {
    try {
      setLoadError(null);
      const [v, c] = await Promise.all([
        ventasApi.listar({ fecha: fecha || undefined, clienteId: clienteId || undefined, metodoPago: metodoPago || undefined }),
        clientesApi.listar(),
      ]);
      setVentas(v);
      setClientes(c);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, clienteId, metodoPago]);

  const nombreCliente = (v: Venta) => v.cliente?.nombre || "Cliente general";

  const inputCls =
    "font-body text-sm px-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <select className={inputCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select className={inputCls} value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
          <option value="">Todos los métodos</option>
          {METODOS.map((m) => (
            <option key={m} value={m} className="capitalize">
              {m}
            </option>
          ))}
        </select>
        {(fecha || clienteId || metodoPago) && (
          <button
            className="font-body text-xs text-ink-soft underline"
            onClick={() => {
              setFecha("");
              setClienteId("");
              setMetodoPago("");
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-warn">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}
      {!loadError && ventas === null && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando…</div>
      )}
      {!loadError && ventas !== null && ventas.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">No hay ventas que coincidan.</div>
      )}

      {!loadError && ventas && ventas.length > 0 && (
        <div className="space-y-2.5">
          {ventas.map((v) => (
            <button
              key={v.id}
              onClick={() => setDetalle(v)}
              className="w-full rounded-xl border border-border bg-surface flex items-center justify-between p-3 text-left hover:shadow-sm transition-shadow"
            >
              <div>
                <div className="font-body text-sm font-medium text-ink">{nombreCliente(v)}</div>
                <div className="font-body text-xs text-ink-soft">
                  {new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · {v.metodoPago}
                </div>
              </div>
              <div className="font-mono text-sm font-semibold text-accent">{money(v.total)}</div>
            </button>
          ))}
        </div>
      )}

      {detalle && <VentaDetalleModal venta={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
