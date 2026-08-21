import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, ShoppingCart, Receipt, AlertTriangle, Package, Warehouse } from "lucide-react";
import { dashboardApi } from "../api/dashboard";
import { ApiError } from "../api/client";
import type { DashboardResumen } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import StatTile from "../components/dashboard/StatTile";
import SalesLineChart from "../components/dashboard/SalesLineChart";
import MagnitudeBarChart from "../components/dashboard/MagnitudeBarChart";

const money = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

type RangoPreset = "1" | "7" | "30" | "90" | "custom";

const RANGO_LABEL: Record<RangoPreset, string> = {
  "1": "Hoy",
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  custom: "Personalizado",
};

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr());
  const [hastaCustom, setHastaCustom] = useState(hoyStr());

  const cargar = async () => {
    try {
      setError(null);
      const params = rango === "custom" ? { desde: desdeCustom, hasta: hastaCustom } : { dias: Number(rango) };
      setData(await dashboardApi.resumen(params));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango, desdeCustom, hastaCustom]);

  if (error) {
    return (
      <div className="font-body text-sm text-center py-10 text-destructive">
        {error} — <button className="underline" onClick={cargar}>reintentar</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { kpis } = data;
  const periodoLabel = data.rango.dias === 1 ? "Hoy" : `${data.rango.desde} a ${data.rango.hasta}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={rango} onValueChange={(v) => setRango(v as RangoPreset)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGO_LABEL) as RangoPreset[]).map((r) => (
              <SelectItem key={r} value={r}>
                {RANGO_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rango === "custom" && (
          <>
            <Input type="date" className="w-auto" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
            <span className="font-body text-xs text-muted-foreground">a</span>
            <Input type="date" className="w-auto" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Ventas de hoy" value={money(kpis.ventasHoy.total)} sublabel={`${kpis.ventasHoy.cantidad} venta(s)`} icon={<DollarSign size={17} />} />
        <StatTile label="Ventas del periodo" value={money(kpis.ventasPeriodo.total)} sublabel={`${kpis.ventasPeriodo.cantidad} venta(s)`} icon={<ShoppingCart size={17} />} />
        <StatTile label="Ticket promedio" value={money(kpis.ticketPromedioPeriodo)} sublabel={periodoLabel} icon={<Receipt size={17} />} />
        <StatTile label="Valor de inventario" value={money(kpis.valorInventario)} sublabel={`${kpis.productosActivos} productos activos`} icon={<Package size={17} />} />
        <StatTile
          label="Stock bajo"
          value={String(kpis.productosStockBajo)}
          sublabel="productos por reponer"
          icon={<AlertTriangle size={17} />}
          tone={kpis.productosStockBajo > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Ventas del periodo</CardTitle>
          <CardDescription>Total vendido por día · {periodoLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesLineChart data={data.ventasPorDia} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Productos más vendidos</CardTitle>
            <CardDescription>{periodoLabel}, por monto vendido</CardDescription>
          </CardHeader>
          <CardContent>
            <MagnitudeBarChart
              items={data.productosTop.map((p) => ({ key: p.productoId, label: p.nombre, value: p.subtotal, sublabel: `${p.cantidad} unidad(es) · ${p.sku}` }))}
              formatValue={money}
              emptyLabel="Aún no hay ventas en este periodo."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Ventas por método de pago</CardTitle>
            <CardDescription>{periodoLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <MagnitudeBarChart
              items={data.ventasPorMetodo.map((m) => ({ key: m.metodoPago, label: m.metodoPago, value: m.total }))}
              formatValue={money}
              emptyLabel="Aún no hay ventas en este periodo."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Warehouse size={16} className="text-muted-foreground" /> Productos con stock bajo
          </CardTitle>
          <CardDescription>
            Los que están en o por debajo de su mínimo — gestiónalos en{" "}
            <Link to="/bodega" className="underline text-primary">
              Bodega
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.stockBajo.length === 0 ? (
            <div className="font-body text-sm text-center py-6 text-muted-foreground">Ningún producto está en su mínimo. 🎉</div>
          ) : (
            <div className="divide-y divide-border">
              {data.stockBajo.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-body text-sm text-foreground truncate">{p.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </div>
                  <div className="font-mono text-xs text-destructive shrink-0">
                    {p.stock} / {p.stockMinimo} {p.unidad}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
