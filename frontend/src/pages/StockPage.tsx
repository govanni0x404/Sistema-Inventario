import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, Download } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
import { exportarCsv } from "../lib/exportCsv";
import { hoyStr } from "../lib/fechas";
import { matchesSearch, normalizeSearch } from "../lib/search";
import { useAuth } from "../context/AuthContext";
import { tieneAcceso } from "../components/nav-data";

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const { usuario } = useAuth();
  const soloStockBajo = params.get("bajo") === "1";
  const puedeAjustar = tieneAcceso(usuario, { seccion: "bodega" });

  const toggleStockBajo = () => {
    const siguientes = new URLSearchParams(params);
    if (soloStockBajo) siguientes.delete("bajo");
    else siguientes.set("bajo", "1");
    setParams(siguientes);
  };

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
    const term = normalizeSearch(q);
    return productos
      .filter((p) => matchesSearch(term, [p.nombre, p.categoria?.nombre, p.codigoBarras]))
      .filter((p) => !soloStockBajo || (p.activo && p.stock <= p.stockMinimo));
  }, [productos, q, soloStockBajo]);

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(filtered, 10, `${q}-${soloStockBajo}`);

  const exportar = () => {
    if (filtered.length === 0) return;
    exportarCsv(
      `stock-${hoyStr()}.csv`,
      filtered.map((p) => ({
        "Código de barras": p.codigoBarras,
        Nombre: p.nombre,
        Categoría: p.categoria?.nombre ?? "",
        Stock: p.stock,
        "Bodega principal": p.stockCaja,
        "Stock mínimo": p.stockMinimo,
        Unidad: p.unidad.nombre,
        Proveedor: p.proveedor?.nombre ?? "",
      }))
    );
  };

  return (
    <div>
      {puedeAjustar && (
        <Link to="/bodega" className="mb-3 inline-block text-sm text-primary underline">
          Registrar entrada o salida
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" aria-label="Buscar productos" placeholder="Buscar producto, código de barras o familia" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant={soloStockBajo ? "default" : "outline"} onClick={toggleStockBajo} aria-pressed={soloStockBajo}>
          <AlertTriangle size={14} /> Stock bajo
        </Button>
        <Button variant="outline" onClick={exportar} disabled={filtered.length === 0}>
          <Download size={14} /> Exportar CSV
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
                <TableHead className="text-right">Stock total</TableHead>
                <TableHead className="text-right">Bodega principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((p) => {
                const low = p.activo && p.stock <= p.stockMinimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-medium text-sm text-foreground">{p.nombre}</span>
                        {p.codigoBarras && <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.codigoBarras}</span>}
                        {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
                        {low && (
                          <Badge variant="warning">
                            <AlertTriangle size={11} /> Stock bajo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {p.stockMinimo} {p.unidad.nombre}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                      {p.stock} <span className="text-muted-foreground font-normal">{p.unidad.nombre}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {p.stockCaja} <span className="text-muted-foreground">{p.unidad.nombre}</span>
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
