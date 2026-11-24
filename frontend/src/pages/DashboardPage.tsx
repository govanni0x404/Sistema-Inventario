import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarDays, ChartNoAxesCombined, FileText, Mail, MapPin, Package, Phone, Receipt, ShoppingCart, Warehouse } from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { ApiError } from "@/api/client";
import type { DashboardResumen } from "@/types/dashboard";
import { useAuth } from "@/context/AuthContext";
import { useNegocio } from "@/context/NegocioContext";
import { tieneAcceso } from "@/components/nav-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import RangoFechasSelector, { type RangoPreset } from "@/components/RangoFechasSelector";
import StatTile from "@/components/dashboard/StatTile";
import SalesLineChart from "@/components/dashboard/SalesLineChart";
import MagnitudeBarChart from "@/components/dashboard/MagnitudeBarChart";
import PaymentMixChart from "@/components/dashboard/PaymentMixChart";
import { fechaCompleta, fechaCorta, hoyStr, validarRango } from "@/lib/fechas";
import { LOCALE, money } from "@/lib/format";

const cantidadVentas = (cantidad: number) => `${cantidad} ${cantidad === 1 ? "venta" : "ventas"}`;
const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
type Resultado = { clave: string; data: DashboardResumen } | { clave: string; error: string };

function resumirActividad(ventas: DashboardResumen["ventasPorDia"]) {
  const semana = diasSemana.map((label, key) => ({ key: String(key), label, dias: 0, ventas: 0 }));
  let diasConVentas = 0;
  let mejorDia: DashboardResumen["ventasPorDia"][number] | undefined;

  for (const dia of ventas) {
    const indice = (new Date(`${dia.fecha}T00:00:00Z`).getUTCDay() + 6) % 7;
    semana[indice].dias++;
    semana[indice].ventas += dia.cantidad;
    if (dia.cantidad > 0) {
      diasConVentas++;
      if (!mejorDia || dia.total > mejorDia.total) mejorDia = dia;
    }
  }

  return {
    diasConVentas,
    mejorDia,
    semana: semana.filter(({ dias }) => dias > 0).map(({ key, label, dias, ventas }) => ({
      key, label, value: ventas / dias, sublabel: cantidadVentas(ventas) + ` en ${dias} ${dias === 1 ? "día" : "días"}`,
    })),
  };
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const { negocio } = useNegocio();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr);
  const [hastaCustom, setHastaCustom] = useState(hoyStr);
  const [intento, setIntento] = useState(0);
  const [metrica, setMetrica] = useState<"total" | "cantidad">("total");
  const desde = rango === "custom" ? desdeCustom : "";
  const hasta = rango === "custom" ? hastaCustom : "";
  const rangoInvalido = rango === "custom" ? validarRango(desde, hasta) : null;
  const clave = `${rango}:${desde}:${hasta}:${intento}`;

  useEffect(() => {
    if (rangoInvalido) return;
    let vigente = true;
    dashboardApi.resumen(rango === "custom" ? { desde, hasta } : { dias: Number(rango) })
      .then((data) => { if (vigente) setResultado({ clave, data }); })
      .catch((error) => {
        if (vigente) setResultado({ clave, error: error instanceof ApiError ? error.message : "No se pudo conectar con el servidor." });
      });
    return () => { vigente = false; };
  }, [rangoInvalido, rango, desde, hasta, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const data = actual && "data" in actual ? actual.data : null;
  const error = actual && "error" in actual ? actual.error : null;
  const cargando = !actual && !rangoInvalido;
  const consultarStock = tieneAcceso(usuario, { seccion: "stock" });
  const abrirCaja = tieneAcceso(usuario, { seccion: "caja" });
  const actividad = data ? resumirActividad(data.ventasPorDia) : null;
  const activos = data?.kpis.productosActivos ?? 0;
  const bajoMinimo = data?.kpis.productosStockBajo ?? 0;
  const stockEnRiesgo = activos > 0 ? bajoMinimo / activos * 100 : 0;
  const periodo = data && (data.rango.desde === data.rango.hasta
    ? fechaCompleta(data.rango.desde)
    : `${fechaCorta(data.rango.desde)} – ${fechaCorta(data.rango.hasta)}`);
  const datosNegocio = [
    { etiqueta: "RUT", valor: negocio.rut && `RUT ${negocio.rut}`, Icono: FileText },
    { etiqueta: "Dirección", valor: negocio.direccion, Icono: MapPin },
    { etiqueta: "Teléfono", valor: negocio.telefono, Icono: Phone },
    { etiqueta: "Correo", valor: negocio.email, Icono: Mail },
  ].filter(({ valor }) => valor);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section aria-labelledby="dashboard-title" className="company-banner overflow-hidden rounded-xl border border-white/10 text-white">
        <div className="px-5 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9">
          <h1 id="dashboard-title" className="text-sm font-semibold text-sidebar-primary">Dashboard</h1>
          <p className="mt-2 max-w-2xl font-display text-3xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
            {negocio.nombre}
          </p>
          {negocio.giro && <p className="mt-2 max-w-2xl text-sm text-hero-muted [overflow-wrap:anywhere]">{negocio.giro}</p>}
          {datosNegocio.length > 0 && (
            <ul aria-label="Datos de la empresa" className="mt-4 flex max-w-3xl flex-wrap gap-x-6 gap-y-2 text-sm text-hero-muted">
              {datosNegocio.map(({ etiqueta, valor, Icono }) => (
                <li key={etiqueta} className="flex min-w-0 items-start gap-2">
                  <Icono size={15} className="mt-0.5 shrink-0 text-sidebar-primary" aria-hidden="true" />
                  <span className="[overflow-wrap:anywhere]">{valor}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-hero/85 px-5 py-3 sm:px-8">
          <p className="flex items-center gap-2 text-sm text-hero-muted">
            <CalendarDays size={16} aria-hidden="true" />
            <time dateTime={hoyStr()}>{fechaCompleta(hoyStr())}</time>
          </p>
          <div className="max-w-full rounded-lg bg-card text-card-foreground">
            <RangoFechasSelector {...{ rango, setRango, desdeCustom, setDesdeCustom, hastaCustom, setHastaCustom }} />
          </div>
        </div>
      </section>

      {rangoInvalido && <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{rangoInvalido}</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
        </div>
      )}
      {cargando && (
        <div aria-label="Cargando panel" role="status" className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <Skeleton className="h-64" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-30" />)}
            </div>
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && actividad && (
        <>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section aria-labelledby="ventas-hoy" className="flex min-w-0 flex-col justify-between gap-7 rounded-xl bg-hero p-5 text-hero-foreground sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-white/12 text-hero-foreground" aria-hidden="true"><ShoppingCart size={18} /></span>
                <h2 className="text-sm font-medium" id="ventas-hoy">Ventas de hoy</h2>
              </div>
              <div>
                <p className="font-display text-[clamp(2rem,4.3vw,4rem)] leading-none font-bold tracking-[-0.07em] tabular-nums [overflow-wrap:anywhere]">{money(data.kpis.ventasHoy.total)}</p>
                <p className="mt-2 text-sm text-hero-muted">{cantidadVentas(data.kpis.ventasHoy.cantidad)}</p>
              </div>
              {abrirCaja && (
                <Link to="/caja" className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md bg-white/12 px-3 text-sm font-semibold transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-hero-foreground">
                  Ir a Caja <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </section>
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
              <StatTile label="Ventas del período" value={money(data.kpis.ventasPeriodo.total)} sublabel={cantidadVentas(data.kpis.ventasPeriodo.cantidad)} icon={<ChartNoAxesCombined size={16} />} />
              <StatTile label="Ticket promedio" value={money(data.kpis.ticketPromedioPeriodo)} sublabel={periodo ?? undefined} icon={<Receipt size={16} />} />
              <StatTile label="Valor de inventario" value={money(data.kpis.valorInventario)} sublabel={`${data.kpis.productosActivos} productos activos`} icon={<Package size={16} />} />
              <StatTile label="Stock bajo" value={String(data.kpis.productosStockBajo)} sublabel="Productos por reponer" icon={<AlertTriangle size={16} />} tone={data.kpis.productosStockBajo > 0 ? "warning" : "default"} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="min-w-0 p-4 shadow-none sm:p-5">
              <section aria-labelledby="ventas-periodo">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="ventas-periodo" className="font-display text-lg font-bold tracking-tight">Evolución de ventas</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{periodo}</p>
                  </div>
                  <div role="group" aria-label="Métrica del gráfico" className="flex gap-1 rounded-lg bg-muted p-1">
                    <Button size="sm" variant={metrica === "total" ? "default" : "ghost"} aria-pressed={metrica === "total"} onClick={() => setMetrica("total")}>Monto</Button>
                    <Button size="sm" variant={metrica === "cantidad" ? "default" : "ghost"} aria-pressed={metrica === "cantidad"} onClick={() => setMetrica("cantidad")}>Cantidad</Button>
                  </div>
                </div>
                <SalesLineChart
                  key={`${data.rango.desde}:${data.rango.hasta}`}
                  data={data.ventasPorDia}
                  metric={metrica}
                />
                <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Días con ventas</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{actividad.diasConVentas} de {data.rango.dias}</dd>
                  </div>
                  {actividad.mejorDia && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Día con mayor monto vendido</dt>
                      <dd className="mt-1 font-semibold">{fechaCorta(actividad.mejorDia.fecha)} · {money(actividad.mejorDia.total)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </Card>

            <Card className="min-w-0 justify-between gap-3 p-4 shadow-none sm:p-5">
              <section aria-labelledby="stock-alerta">
                <h2 id="stock-alerta" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
                  <Warehouse size={17} className="text-muted-foreground" aria-hidden="true" /> Productos con stock bajo
                </h2>
                {activos > 0 && (
                  <div className="mt-4 rounded-lg bg-muted/55 p-3">
                    <div aria-hidden="true" className="mb-2 h-2.5 overflow-hidden rounded-full bg-primary">
                      <div className="h-full bg-[#d29b42]" style={{ width: `${stockEnRiesgo}%` }} />
                    </div>
                    <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-[#d29b42]" /><strong className="text-foreground">{bajoMinimo}</strong> en el mínimo o por debajo</span>
                      <span><span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-primary" /><strong className="text-foreground">{activos - bajoMinimo}</strong> sobre el mínimo</span>
                    </p>
                  </div>
                )}
                {activos === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Todavía no hay productos activos.</p>
                ) : data.stockBajo.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-muted/55 p-4 text-sm text-muted-foreground">Todos los productos activos están por encima de su mínimo.</p>
                ) : (
                  <ul className="mt-2 divide-y">
                    {data.stockBajo.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium [overflow-wrap:anywhere]">{p.nombre}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                        </div>
                        <span className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                          {p.stock} de {p.stockMinimo} {p.unidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {bajoMinimo > data.stockBajo.length && (
                  <p className="mt-2 text-xs text-muted-foreground">Mostrando {data.stockBajo.length} de {bajoMinimo} productos.</p>
                )}
              </section>
              {consultarStock && (
                <Link to="/stock?bajo=1" className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                  Ver stock bajo <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <Card className="min-w-0 gap-4 p-4 shadow-none sm:p-5">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Actividad por día de la semana</h2>
                <p className="mt-1 text-xs text-muted-foreground">Promedio de ventas por día, incluidos los días sin ventas.</p>
              </div>
              <MagnitudeBarChart
                items={actividad.diasConVentas ? actividad.semana : []}
                formatValue={decimal.format}
                emptyLabel="Aún no hay ventas en este período."
              />
            </Card>
            <Card className="min-w-0 gap-4 p-4 shadow-none sm:p-5">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Productos con mayor monto vendido</h2>
                <p className="mt-1 text-xs text-muted-foreground">Los cinco productos con mayor subtotal del período.</p>
              </div>
              <MagnitudeBarChart
                items={data.productosTop.map((p) => ({ key: p.productoId, label: p.nombre, value: p.subtotal, sublabel: `${p.cantidad} unidades · ${p.sku}` }))}
                formatValue={money}
              />
            </Card>
            <Card className="min-w-0 gap-4 p-4 shadow-none sm:p-5 lg:col-span-2 2xl:col-span-1">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Pagos por método</h2>
                <p className="mt-1 text-xs text-muted-foreground">Monto y proporción del total pagado en el período.</p>
              </div>
              <PaymentMixChart payments={data.ventasPorMetodo} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
