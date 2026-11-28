import { useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ventasApi } from "../api/ventas";
import { clientesApi } from "../api/clientes";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import { ETIQUETAS_PAGO, type Venta } from "../types/venta";
import type { Cliente } from "../types/cliente";
import type { TurnoCaja } from "../types/turno";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import VentaDetalleModal from "../components/VentaDetalleModal";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { exportarCsv } from "../lib/exportCsv";
import { LOCALE, money } from "../lib/format";
import { folioComprobante } from "../lib/printTicket";
import { validarRango } from "../lib/fechas";


const TODOS = "__todos__";

type RangoPreset = "hoy" | "7d" | "30d" | "90d" | "custom";

const RANGO_LABEL: Record<RangoPreset, string> = {
  hoy: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  custom: "Personalizado",
};

function hoyStr() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function haceDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const MAX_VENTAS = 1000;

export default function HistorialPage() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [turnos, setTurnos] = useState<TurnoCaja[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // El backend devuelve como máximo MAX_VENTAS; se pide una más para saber si hubo recorte.
  const [truncado, setTruncado] = useState(false);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [rango, setRango] = useState<RangoPreset>("hoy");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr());
  const [hastaCustom, setHastaCustom] = useState(hoyStr());
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [turnoCajaId, setTurnoCajaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const folio = searchParams.get("folio")?.trim() ?? "";
  const [entradaFolio, setEntradaFolio] = useState({ aplicada: folio, texto: folio });
  const folioTexto = entradaFolio.aplicada === folio ? entradaFolio.texto : folio;
  const solicitudActual = useRef(0);

  const cambiarFolio = (valor: string) => {
    const aplicado = valor.trim();
    setEntradaFolio({ aplicada: aplicado, texto: aplicado });
    if (aplicado === folio) return;
    const query = new URLSearchParams(searchParams);
    if (aplicado) query.set("folio", aplicado);
    else query.delete("folio");
    setSearchParams(query, { replace: true });
  };

  const parametrosFecha = () => {
    if (turnoCajaId || folio) return {};
    if (rango === "hoy") return { fecha: hoyStr() };
    if (rango === "custom") return desdeCustom && hastaCustom ? { desde: desdeCustom, hasta: hastaCustom } : { fecha: hoyStr() };
    const dias = rango === "7d" ? 7 : rango === "30d" ? 30 : 90;
    return { desde: haceDias(dias), hasta: hoyStr() };
  };

  const cargar = async () => {
    const solicitud = ++solicitudActual.current;
    setVentas(null);
    setTruncado(false);
    setLoadError(null);
    try {
      if (rango === "custom" && !turnoCajaId && !folio) {
        const error = validarRango(desdeCustom, hastaCustom);
        if (error) {
          setLoadError(error);
          return;
        }
      }
      const v = await ventasApi.listar({
        ...parametrosFecha(),
        clienteId: clienteId || undefined,
        metodoPago: metodoPago || undefined,
        turnoCajaId: turnoCajaId || undefined,
        limite: MAX_VENTAS + 1,
        folio: folio || undefined,
        tipo: tipo || undefined,
      });
      if (solicitud !== solicitudActual.current) return;
      setTruncado(v.length > MAX_VENTAS);
      setVentas(v.slice(0, MAX_VENTAS));
    } catch (e) {
      if (solicitud === solicitudActual.current) {
        setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
      }
    }
  };

  // Clientes y turnos (opciones de los filtros) se cargan una sola vez, no con cada cambio de filtro.
  const filtrosCargados = useRef(false);
  const cargarFiltros = async () => {
    try {
      const [c, t] = await Promise.all([clientesApi.listar(), turnosApi.listar()]);
      setClientes(c);
      setTurnos(t);
      filtrosCargados.current = true;
    } catch {
      // Sin las listas, los filtros quedan vacíos; "reintentar" vuelve a pedirlas.
    }
  };

  const reintentar = () => {
    cargar();
    if (!filtrosCargados.current) cargarFiltros();
  };

  useEffect(() => {
    cargarFiltros();
  }, []);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango, desdeCustom, hastaCustom, clienteId, metodoPago, turnoCajaId, tipo, folio]);

  const nombreCliente = (v: Venta) => v.cliente?.nombre || "Cliente general";
  const totalDevuelto = (v: Venta) => (v.devoluciones ?? []).reduce((total, d) => total + d.total, 0);

  const nombreTurno = (t: TurnoCaja) =>
    `${t.caja.nombre} · ${t.tipoTurno.nombre} · ${new Date(t.fechaApertura).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })}${
      t.estado === "abierto" ? " (abierto)" : ""
    }`;

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(
    ventas ?? [],
    10,
    `${rango}-${desdeCustom}-${hastaCustom}-${clienteId}-${metodoPago}-${turnoCajaId}-${tipo}-${folio}`
  );

  const hayFiltros = rango !== "hoy" || clienteId || metodoPago || turnoCajaId || tipo || folio || folioTexto;

  const exportar = () => {
    if (!ventas || ventas.length === 0) return;
    exportarCsv(
      `historial-ventas-${hoyStr()}.csv`,
      ventas.map((v) => ({
        Folio: folioComprobante(v.id),
        Fecha: new Date(v.fecha).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" }),
        Cliente: nombreCliente(v),
        Turno: v.turnoCaja?.tipoTurno.nombre ?? "",
        Caja: v.turnoCaja?.caja.nombre ?? "",
        "Método de pago": v.esCortesia ? `Cortesía (${v.motivoCortesia ?? ""})` : v.pagos.map((p) => ETIQUETAS_PAGO[p.metodoPago] ?? p.metodoPago).join(" + "),
        Subtotal: v.subtotal,
        Descuento: v.descuento,
        Total: v.total,
        "Tiene devolución": (v.devoluciones?.length ?? 0) > 0 ? "Sí" : "No",
        "Monto reembolsado": totalDevuelto(v),
      }))
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select
          value={rango}
          onValueChange={(v) => {
            setRango(v as RangoPreset);
            setTurnoCajaId("");
          }}
          disabled={!!turnoCajaId || !!folio}
        >
          <SelectTrigger className="w-44" aria-label="Período">
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
        {rango === "custom" && !turnoCajaId && !folio && (
          <>
            <Input type="date" aria-label="Desde" className="w-auto" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
            <span className="font-body text-xs text-muted-foreground">a</span>
            <Input type="date" aria-label="Hasta" className="w-auto" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
          </>
        )}
        <Select
          value={turnoCajaId || TODOS}
          onValueChange={(v) => {
            setTurnoCajaId(v === TODOS ? "" : v);
            setRango("hoy");
          }}
        >
          <SelectTrigger className="w-52" aria-label="Turno">
            <SelectValue placeholder="Todos los turnos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los turnos</SelectItem>
            {turnos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {nombreTurno(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clienteId || TODOS} onValueChange={(v) => setClienteId(v === TODOS ? "" : v)}>
          <SelectTrigger className="w-48" aria-label="Cliente">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={metodoPago || TODOS} onValueChange={(v) => setMetodoPago(v === TODOS ? "" : v)}>
          <SelectTrigger className="w-44" aria-label="Forma de pago">
            <SelectValue placeholder="Todos los métodos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los métodos</SelectItem>
            {Object.entries(ETIQUETAS_PAGO).map(([m, etiqueta]) => (
              <SelectItem key={m} value={m}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo || TODOS} onValueChange={(v) => setTipo(v === TODOS ? "" : v)}>
          <SelectTrigger className="w-44" aria-label="Tipo de venta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los tipos</SelectItem>
            <SelectItem value="cobrada">Ventas cobradas</SelectItem>
            <SelectItem value="cortesia">Cortesías</SelectItem>
            <SelectItem value="con-devolucion">Con devolución</SelectItem>
          </SelectContent>
        </Select>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRango("hoy");
              setClienteId("");
              setMetodoPago("");
              setTurnoCajaId("");
              setTipo("");
              cambiarFolio("");
            }}
          >
            Limpiar filtros
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportar} disabled={!ventas || ventas.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      <div className="mb-4 space-y-1">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          cambiarFolio(folioTexto);
        }}>
          <Input
            aria-label="Folio del comprobante"
            placeholder="Folio del comprobante"
            className="w-55"
            maxLength={36}
            value={folioTexto}
            onChange={(e) => setEntradaFolio({ aplicada: folio, texto: e.target.value })}
          />
          <Button type="submit" variant="outline"><Search size={14} /> Buscar folio</Button>
        </form>
        {folio && <p className="text-xs text-muted-foreground">La búsqueda por folio abarca todas las fechas.</p>}
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-destructive">
          {loadError} — <button className="underline" onClick={reintentar}>reintentar</button>
        </div>
      )}
      {!loadError && ventas === null && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {!loadError && truncado && (
        <div className="font-body text-sm rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground">
          Hay más de {MAX_VENTAS} ventas en este filtro: se muestran las {MAX_VENTAS} más recientes. Acota el rango de fechas
          para ver el resto.
        </div>
      )}
      {!loadError && ventas !== null && ventas.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas que coincidan.</div>
      )}

      {!loadError && ventas && ventas.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Devoluciones</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setDetalle(v)}>
                  <TableCell className="font-mono text-xs font-semibold">{folioComprobante(v.id)}</TableCell>
                  <TableCell className="font-body text-sm font-medium text-foreground">{nombreCliente(v)}</TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">
                    {new Date(v.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">{v.turnoCaja ? `${v.turnoCaja.caja.nombre} · ${v.turnoCaja.tipoTurno.nombre}` : "—"}</TableCell>
                  <TableCell>
                    {v.esCortesia ? (
                      <Badge variant="warning">Cortesía</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {v.pagos.map((p) => (
                          <Badge key={p.id} variant="secondary" className="capitalize">
                            {ETIQUETAS_PAGO[p.metodoPago]} · {money(p.monto)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(v.devoluciones?.length ?? 0) > 0 && <Badge variant="outline">{v.devoluciones?.length} · {money(totalDevuelto(v))}</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(v.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" aria-label={`Ver detalle del folio ${folioComprobante(v.id)}`} onClick={(e) => {
                      e.stopPropagation();
                      setDetalle(v);
                    }}>
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />

      <VentaDetalleModal
        venta={detalle}
        onClose={() => setDetalle(null)}
        onCambio={(actualizada) => {
          setDetalle(actualizada);
          setVentas((prev) => prev?.map((v) => (v.id === actualizada.id ? actualizada : v)) ?? prev);
        }}
      />
    </div>
  );
}
