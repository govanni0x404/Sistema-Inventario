import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { productosApi } from "../api/productos";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";

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

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(filtered, 10, `${q}-${soloStockBajo}`);

  return (
    <div>
      <p className="font-body text-xs text-muted-foreground mb-3">
        Vista de solo lectura. Para ajustar cantidades usa{" "}
        <Link to="/bodega" className="underline text-primary">
          Bodega
        </Link>
        .
      </p>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, SKU o categoría" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant={soloStockBajo ? "default" : "outline"} onClick={() => setSoloStockBajo((v) => !v)}>
          <AlertTriangle size={14} /> Stock bajo
        </Button>
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
                <TableHead>Mínimo</TableHead>
                <TableHead className="text-right">Stock actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => {
                const low = p.stock <= p.stockMinimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.sku}</span>
                        {low && (
                          <Badge variant="warning">
                            <AlertTriangle size={11} /> Stock bajo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {p.stockMinimo} {p.unidad}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {p.stock} <span className="text-muted-foreground font-normal">{p.unidad}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}
