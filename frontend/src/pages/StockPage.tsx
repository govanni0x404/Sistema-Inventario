import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);

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
    return productos
      .filter((p) => (p.nombre + p.sku + (p.categoria || "")).toLowerCase().includes(term))
      .filter((p) => !soloStockBajo || p.stock <= p.stockMinimo);
  }, [productos, q, soloStockBajo]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-body text-xs text-ink-soft">
          Vista de solo lectura. Para ajustar cantidades usa{" "}
          <Link to="/bodega" className="underline text-accent">
            Bodega
          </Link>
          .
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 mt-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            className="w-full font-body text-sm pl-9 pr-3 py-2 rounded-lg outline-none border border-border text-ink bg-white focus:border-accent transition-colors"
            placeholder="Buscar por nombre, SKU o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSoloStockBajo((v) => !v)}
          className={`flex items-center gap-1.5 font-body text-sm font-medium px-3.5 py-2 rounded-lg shrink-0 border ${
            soloStockBajo ? "bg-warn-soft text-warn border-warn/30" : "border-border text-ink-soft"
          }`}
        >
          <AlertTriangle size={14} /> Stock bajo
        </button>
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-warn">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}
      {!loadError && productos === null && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">Cargando…</div>
      )}
      {!loadError && productos !== null && filtered.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-ink-soft">No hay productos que coincidan.</div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((p) => {
            const low = p.stock <= p.stockMinimo;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-medium text-sm text-ink">{p.nombre}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg text-ink-soft">{p.sku}</span>
                    {low && (
                      <span className="flex items-center gap-1 font-body text-xs px-1.5 py-0.5 rounded bg-warn-soft text-warn">
                        <AlertTriangle size={11} /> Stock bajo
                      </span>
                    )}
                  </div>
                  <div className="font-body text-xs mt-0.5 text-ink-soft">
                    Mínimo: <span className="font-mono">{p.stockMinimo}</span> {p.unidad}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold shrink-0 text-ink">
                  {p.stock} <span className="text-ink-soft font-normal">{p.unidad}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
