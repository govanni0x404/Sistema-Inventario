import { useCallback, useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { consultasApi } from "../api/consultas";
import { ETIQUETAS_PAGO } from "../types/venta";
import { ApiError } from "../api/client";
import type { ConsultaParams, DetallePago, DetalleProducto, DetalleReporteResponse } from "../types/consulta";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RangoFechasSelector from "../components/RangoFechasSelector";
import type { RangoPreset } from "../components/RangoFechasSelector";
import { exportarCsv } from "../lib/exportCsv";
import MagnitudeBarChart from "../components/dashboard/MagnitudeBarChart";
import HistorialPage from "./HistorialPage";
import TurnosPage from "./TurnosPage";
import { LOCALE, money } from "../lib/format";
import { hoyStr, validarRango } from "../lib/fechas";
import { useAuth } from "../context/AuthContext";
import { tieneAcceso } from "../components/nav-data";
import { Badge } from "@/components/ui/badge";
import { folioComprobante } from "../lib/printTicket";
import { usePagedList } from "../hooks/usePagedList";
import DataPagination from "../components/DataPagination";

const cargarProductosTop = (params: ConsultaParams) => consultasApi.productosTop(params, 30).then((data) => data.productos);
const cargarPorUsuario = (params: ConsultaParams) => consultasApi.ventasPorUsuario(params).then((data) => data.usuarios);
const cargarPorMetodo = (params: ConsultaParams) => consultasApi.ventasPorMetodo(params).then((data) => data.metodos);
const cargarMargenes = (params: ConsultaParams) => consultasApi.productosMargen(params, 20).then((data) => data.productos);

function useReporte<T>(cargar: (params: ConsultaParams) => Promise<T>, claveFiltros = "") {
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr);
  const [hastaCustom, setHastaCustom] = useState(hoyStr);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; datos: T } | { clave: string; error: string } | null>(null);
  const desde = rango === "custom" ? desdeCustom : "";
  const hasta = rango === "custom" ? hastaCustom : "";
  const rangoInvalido = rango === "custom" ? validarRango(desde, hasta) : null;
  const clave = `${rango}:${desde}:${hasta}:${intento}:${claveFiltros}`;

  useEffect(() => {
    if (rangoInvalido) return;
    let vigente = true;
    cargar(rango === "custom" ? { desde, hasta } : { dias: Number(rango) })
      .then((datos) => { if (vigente) setResultado({ clave, datos }); })
      .catch((e) => {
        if (vigente) setResultado({ clave, error: e instanceof ApiError ? e.message : "No se pudo cargar el reporte." });
      });
    return () => { vigente = false; };
  }, [cargar, rango, desde, hasta, rangoInvalido, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  return {
    rango, setRango, desdeCustom, setDesdeCustom, hastaCustom, setHastaCustom, clave,
    datos: actual && "datos" in actual ? actual.datos : null,
    error: rangoInvalido ?? (actual && "error" in actual ? actual.error : null),
    reintentar: rangoInvalido ? undefined : () => setIntento((n) => n + 1),
  };
}

function EstadoReporte({ error, reintentar }: { error: string | null; reintentar?: () => void }) {
  if (error) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        {error}
        {reintentar && <Button variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>}
      </div>
    );
  }
  return (
    <div role="status" aria-label="Cargando reporte" className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

function ProductosTopReport() {
  const r = useReporte(cargarProductosTop);
  const productos = r.datos;

  const exportar = () => {
    if (!productos || productos.length === 0) return;
    exportarCsv(
      `productos-mas-vendidos-${hoyStr()}.csv`,
      productos.map((p) => ({ Producto: p.nombre, "Código de barras": p.codigoBarras ?? "", Unidades: p.cantidad, "Monto vendido": p.subtotal }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!productos || productos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      {productos === null && <EstadoReporte {...r} />}
      {productos && productos.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {productos && productos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Monto vendido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.productoId}>
                  <TableCell>
                    <div className="font-body text-sm font-medium text-foreground">{p.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.codigoBarras}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{p.cantidad}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(p.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function VentasPorUsuarioReport() {
  const r = useReporte(cargarPorUsuario);
  const usuarios = r.datos;

  const exportar = () => {
    if (!usuarios || usuarios.length === 0) return;
    exportarCsv(
      `ventas-por-usuario-${hoyStr()}.csv`,
      usuarios.map((u) => ({
        Usuario: u.nombre,
        Ventas: u.cantidadVentas,
        Cortesías: u.cantidadCortesias,
        "Total vendido": u.total,
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!usuarios || usuarios.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      {usuarios === null && <EstadoReporte {...r} />}
      {usuarios && usuarios.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {usuarios && usuarios.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Cortesías</TableHead>
                <TableHead className="text-right">Total vendido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.usuarioId ?? "sin-usuario"}>
                  <TableCell className="font-body text-sm font-medium text-foreground">{u.nombre}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{u.cantidadVentas}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{u.cantidadCortesias || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(u.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function VentasPorMetodoReport() {
  const r = useReporte(cargarPorMetodo);
  const metodos = r.datos;

  const exportar = () => {
    if (!metodos || metodos.length === 0) return;
    exportarCsv(
      `ventas-por-metodo-${hoyStr()}.csv`,
      metodos.map((m) => ({ "Método de pago": m.metodoPago, "Cantidad de pagos": m.cantidad, Total: m.total }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!metodos || metodos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      {metodos === null && <EstadoReporte {...r} />}
      {metodos && metodos.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {metodos && metodos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método de pago</TableHead>
                <TableHead className="text-right">Cantidad de pagos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metodos.map((m) => (
                <TableRow key={m.metodoPago}>
                  <TableCell className="font-body text-sm font-medium text-foreground capitalize">{m.metodoPago}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{m.cantidad}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(m.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type FilaDetalle = { id: string; ventaId: string; fecha: string };
type ColumnaDetalle<T> = {
  titulo: string;
  valor: (fila: T) => string | number;
  formato?: (fila: T) => string;
  numerica?: boolean;
};

const columnasPagos: ColumnaDetalle<DetallePago>[] = [
  { titulo: "Operación", valor: (p) => p.operacion === "cobro" ? "Cobro" : "Reembolso" },
  { titulo: "Forma de pago", valor: (p) => p.metodoPago ?? "Sin registrar" },
  { titulo: "Cliente", valor: (p) => p.cliente ?? "Cliente general" },
  { titulo: "Monto", valor: (p) => p.monto, formato: (p) => money(p.monto), numerica: true },
];

const columnasProductos: ColumnaDetalle<DetalleProducto>[] = [
  { titulo: "Producto", valor: (p) => p.producto },
  { titulo: "Código de barras", valor: (p) => p.codigoBarras ?? "—" },
  { titulo: "Tipo de venta", valor: (p) => p.esCortesia ? "Cortesía" : "Cobrada" },
  { titulo: "Unidades", valor: (p) => p.cantidad, numerica: true },
  { titulo: "Devueltas", valor: (p) => p.cantidadDevuelta, numerica: true },
  { titulo: "Subtotal de línea", valor: (p) => p.subtotal, formato: (p) => money(p.subtotal), numerica: true },
];

function DetalleReporte<T extends FilaDetalle>({
  columnas, tipo, descripcion, consultar,
}: {
  columnas: ColumnaDetalle<T>[];
  tipo: "pagos" | "productos";
  descripcion: string;
  consultar: (params: ConsultaParams, filtros: { folio?: string; metodo?: string; producto?: string }) => Promise<DetalleReporteResponse<T>>;
}) {
  const { usuario } = useAuth();
  const verHistorial = tieneAcceso(usuario, { seccion: "historial" });
  const [metodo, setMetodo] = useState("todos");
  const [folioTexto, setFolioTexto] = useState("");
  const [productoTexto, setProductoTexto] = useState("");
  const [filtros, setFiltros] = useState({ folio: "", producto: "" });
  const cargar = useCallback((params: ConsultaParams) => consultar(params, {
    ...filtros,
    metodo: metodo === "todos" ? undefined : metodo,
  }), [consultar, filtros, metodo]);
  const r = useReporte(cargar, JSON.stringify([filtros, metodo]));
  const filas = r.datos?.filas ?? [];
  const paginacion = usePagedList(filas, 15, r.clave);
  const fecha = (f: T) => new Date(f.fecha).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" });

  const exportar = () => exportarCsv(`detalle-${tipo}-${hoyStr()}.csv`, filas.map((f) => ({
    Fecha: fecha(f),
    Folio: folioComprobante(f.ventaId),
    ...Object.fromEntries(columnas.map((c) => [c.titulo, c.valor(f)])),
  })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        {tipo === "pagos" && (
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger aria-label="Forma de pago" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las formas</SelectItem>
              {Object.entries(ETIQUETAS_PAGO).map(([metodo, etiqueta]) => <SelectItem key={metodo} value={metodo}>{etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={exportar} disabled={filas.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        setFiltros({ folio: folioTexto.trim(), producto: productoTexto.trim() });
      }}>
        <Input aria-label="Folio del comprobante" className="w-44" placeholder="Folio" maxLength={36} value={folioTexto} onChange={(e) => setFolioTexto(e.target.value)} />
        {tipo === "productos" && (
          <Input aria-label="Nombre o código de barras" className="max-w-64" placeholder="Producto o código de barras" maxLength={150} value={productoTexto} onChange={(e) => setProductoTexto(e.target.value)} />
        )}
        <Button type="submit" variant="outline"><Search size={14} /> Buscar</Button>
      </form>
      <p className="text-sm text-muted-foreground">{descripcion}</p>
      {r.datos === null && <EstadoReporte {...r} />}
      {r.datos?.truncado && (
        <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          Se incluyen las {filas.length} filas más recientes en la tabla y el CSV. Acota los filtros para consultar las anteriores.
        </p>
      )}
      {r.datos && filas.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hay registros que coincidan con los filtros.</p>}
      {filas.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Folio</TableHead>
                {columnas.map((c) => <TableHead key={c.titulo} className={c.numerica ? "text-right" : undefined}>{c.titulo}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginacion.pageItems.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{fecha(f)}</TableCell>
                  <TableCell className="font-mono">
                    {verHistorial ? (
                      <Link className="font-semibold text-primary underline-offset-2 hover:underline" to={`/historial?folio=${encodeURIComponent(f.ventaId)}`}>{folioComprobante(f.ventaId)}</Link>
                    ) : folioComprobante(f.ventaId)}
                  </TableCell>
                  {columnas.map((c) => <TableCell key={c.titulo} className={c.numerica ? "text-right tabular-nums" : undefined}>{c.formato ? c.formato(f) : c.valor(f)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <DataPagination page={paginacion.page} totalItems={paginacion.totalItems} pageSize={paginacion.pageSize} onPageChange={paginacion.setPage} />
    </div>
  );
}

function ProductosMargenReport() {
  const r = useReporte(cargarMargenes);
  const productos = r.datos;

  const exportar = () => {
    if (!productos || productos.length === 0) return;
    exportarCsv(
      `margen-por-producto-${hoyStr()}.csv`,
      productos.map((p) => ({
        Producto: p.nombre,
        "Código de barras": p.codigoBarras ?? "",
        Unidades: p.cantidad,
        Ingreso: p.ingreso,
        Costo: p.costo,
        "Costo estimado": p.costoEstimado ? "Sí" : "No",
        Margen: p.margen,
        "Margen %": p.margenPct.toFixed(1),
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!productos || productos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      <p className="font-body text-xs text-muted-foreground">
        El ingreso incorpora los descuentos de la venta y se calcula antes de devoluciones. El costo se registra al vender. Las ventas antiguas sin costo registrado usan el precio de compra actual.
      </p>
      {productos === null && <EstadoReporte {...r} />}
      {productos && productos.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {productos && productos.length > 0 && (
        <>
          <MagnitudeBarChart
            items={productos.map((p) => ({
              key: p.productoId,
              label: p.nombre,
              value: p.margen,
              sublabel: `Ingreso ${money(p.ingreso)} · Costo ${money(p.costo)} · Margen ${p.margenPct.toFixed(1)}%`,
            }))}
            formatValue={money}
          />
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p) => (
                  <TableRow key={p.productoId}>
                    <TableCell>
                      <div className="font-body text-sm font-medium text-foreground">{p.nombre}</div>
                      <div className="font-mono text-xs text-muted-foreground">{p.codigoBarras}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">{p.cantidad}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">{money(p.ingreso)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {money(p.costo)}
                      {p.costoEstimado && <div className="mt-0.5"><Badge variant="outline" className="font-body text-[10px]">Estimado</Badge></div>}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${p.margen < 0 ? "text-destructive" : "text-primary"}`}>{money(p.margen)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">{p.margenPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

export default function ConsultasPage() {
  const { usuario } = useAuth();
  const verHistorial = tieneAcceso(usuario, { seccion: "historial" });
  const verTurnos = tieneAcceso(usuario, { seccion: "turnos" });
  return (
    <Tabs defaultValue={verHistorial ? "detalle-venta" : "productos-top"}>
      <TabsList aria-label="Reportes disponibles" className="h-auto flex-wrap">
        {verHistorial && <TabsTrigger value="detalle-venta">Detalle de venta</TabsTrigger>}
        <TabsTrigger value="detalle-pagos">Detalle de pagos</TabsTrigger>
        <TabsTrigger value="detalle-productos">Detalle de productos</TabsTrigger>
        <TabsTrigger value="productos-top">Productos más vendidos</TabsTrigger>
        {verTurnos && <TabsTrigger value="turnos">Cierre de turnos</TabsTrigger>}
        <TabsTrigger value="por-usuario">Ventas por usuario</TabsTrigger>
        <TabsTrigger value="por-metodo">Ventas por forma de pago</TabsTrigger>
        <TabsTrigger value="margenes">Márgenes por producto</TabsTrigger>
      </TabsList>

      {verHistorial && <TabsContent value="detalle-venta">
        <HistorialPage />
      </TabsContent>}
      <TabsContent value="detalle-pagos">
        <DetalleReporte tipo="pagos" columnas={columnasPagos} consultar={consultasApi.detallePagos} descripcion="Cobros y reembolsos por fecha de operación. Un pago dividido aparece en una fila por cada forma de pago." />
      </TabsContent>
      <TabsContent value="detalle-productos">
        <DetalleReporte tipo="productos" columnas={columnasProductos} consultar={consultasApi.detalleProductos} descripcion="Productos por comprobante, con las unidades devueltas hasta hoy. El subtotal incluye el descuento de la línea." />
      </TabsContent>
      <TabsContent value="productos-top">
        <ProductosTopReport />
      </TabsContent>
      {verTurnos && <TabsContent value="turnos">
        <TurnosPage />
      </TabsContent>}
      <TabsContent value="por-usuario">
        <VentasPorUsuarioReport />
      </TabsContent>
      <TabsContent value="por-metodo">
        <VentasPorMetodoReport />
      </TabsContent>
      <TabsContent value="margenes">
        <ProductosMargenReport />
      </TabsContent>
    </Tabs>
  );
}
