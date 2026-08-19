import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, ShoppingCart, Receipt, AlertTriangle, Package, Warehouse } from "lucide-react";
import { dashboardApi } from "../api/dashboard";
import { ApiError } from "../api/client";
import type { DashboardResumen } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatTile from "../components/dashboard/StatTile";
import SalesLineChart from "../components/dashboard/SalesLineChart";
import MagnitudeBarChart from "../components/dashboard/MagnitudeBarChart";

const money = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    try {
      setError(null);
      setData(await dashboardApi.resumen());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Ventas de hoy" value={money(kpis.ventasHoy.total)} sublabel={`${kpis.ventasHoy.cantidad} venta(s)`} icon={<DollarSign size={17} />} />
        <StatTile label="Ventas del mes" value={money(kpis.ventasMes.total)} sublabel={`${kpis.ventasMes.cantidad} venta(s)`} icon={<ShoppingCart size={17} />} />
        <StatTile label="Ticket promedio" value={money(kpis.ticketPromedioMes)} sublabel="Este mes" icon={<Receipt size={17} />} />
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
          <CardTitle className="font-display text-base">Ventas de los últimos 14 días</CardTitle>
          <CardDescription>Total vendido por día</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesLineChart data={data.ventasPorDia} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Productos más vendidos</CardTitle>
            <CardDescription>Este mes, por monto vendido</CardDescription>
          </CardHeader>
          <CardContent>
            <MagnitudeBarChart
              items={data.productosTop.map((p) => ({ key: p.productoId, label: p.nombre, value: p.subtotal, sublabel: `${p.cantidad} unidad(es) · ${p.sku}` }))}
              formatValue={money}
              emptyLabel="Aún no hay ventas este mes."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Ventas por método de pago</CardTitle>
            <CardDescription>Este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <MagnitudeBarChart
              items={data.ventasPorMetodo.map((m) => ({ key: m.metodoPago, label: m.metodoPago, value: m.total }))}
              formatValue={money}
              emptyLabel="Aún no hay ventas este mes."
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
