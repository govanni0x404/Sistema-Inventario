import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardCheck, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { bodegasApi } from "@/api/bodegas";
import { ApiError } from "@/api/client";
import DataPagination from "@/components/DataPagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagedList } from "@/hooks/usePagedList";
import { LOCALE } from "@/lib/format";
import { matchesSearch, normalizeSearch } from "@/lib/search";
import type { Bodega, ModoInventario, ResumenTomaInventario, StockBodegaItem, TomaInventario } from "@/types/bodega";

const MAX_LINEAS = 200;
const MAX_STOCK = 2_147_483_647;
const formatoFecha = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });
const formatoCantidad = new Intl.NumberFormat(LOCALE);
const formatoDiferencia = new Intl.NumberFormat(LOCALE, { signDisplay: "exceptZero" });
const nombreOperacion = { inventario: "Toma de inventario", ajuste: "Ajuste puntual" };
const cantidadValida = /^\d+$/;

function idOperacion() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function TomaInventarioPage() {
  const [bodegas, setBodegas] = useState<Bodega[] | null>(null);
  const [bodegaId, setBodegaId] = useState("");
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    bodegasApi.listar()
      .then((datos) => {
        if (!vigente) return;
        setBodegas(datos);
        setBodegaId(datos.find(({ activo }) => activo)?.id ?? datos[0]?.id ?? "");
      })
      .catch(() => { if (vigente) setError("No se pudieron cargar las bodegas."); });
    return () => { vigente = false; };
  }, [intento]);

  const bodega = bodegas?.find(({ id }) => id === bodegaId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-lg text-sm text-muted-foreground">Registra el conteo físico de una bodega o corrige las existencias de un producto.</p>
        {bodegas && bodegas.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="bodega-conteo">Bodega</Label>
            <Select value={bodegaId} onValueChange={setBodegaId}>
              <SelectTrigger id="bodega-conteo" className="w-full min-w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {bodegas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nombre}{item.activo ? "" : " (inactiva)"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error} <Button variant="link" onClick={() => { setError(""); setIntento((n) => n + 1); }}>Reintentar</Button></p>
      ) : !bodegas ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando bodegas…</p>
      ) : !bodega ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Todavía no hay bodegas configuradas.</p>
      ) : <InventarioBodega key={bodega.id} bodega={bodega} />}
    </div>
  );
}

function InventarioBodega({ bodega }: { bodega: Bodega }) {
  const [stock, setStock] = useState<StockBodegaItem[] | null>(null);
  const [historial, setHistorial] = useState<ResumenTomaInventario[]>([]);
  const [modo, setModo] = useState<ModoInventario>("inventario");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [errorDatos, setErrorDatos] = useState("");
  const [errorGuardar, setErrorGuardar] = useState("");
  const [conflicto, setConflicto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [detalle, setDetalle] = useState<TomaInventario | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const pendiente = useRef<{ firma: string; id: string } | null>(null);
  const enviando = useRef(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([bodegasApi.stock(bodega.id), bodegasApi.listarTomas(bodega.id)])
      .then(([existencias, tomas]) => {
        if (!vigente) return;
        setStock(existencias);
        setHistorial(tomas);
      })
      .catch(() => { if (vigente) setErrorDatos("No se pudo cargar el inventario de esta bodega."); });
    return () => { vigente = false; };
  }, [bodega.id, intento]);

  const items = stock?.flatMap(({ productoId, cantidad }) => {
    const valor = cantidades[productoId];
    return valor ? [{ productoId, stockEsperado: cantidad, stockContado: cantidadValida.test(valor) ? Number(valor) : NaN }] : [];
  }) ?? [];
  const diferencias = items.filter(({ stockContado, stockEsperado }) => Number.isInteger(stockContado) && stockContado !== stockEsperado).length;
  const cantidadesInvalidas = items.some(({ stockContado }) => !Number.isInteger(stockContado) || stockContado > MAX_STOCK);
  const puedeGuardar = !guardando && !conflicto && motivo.trim().length > 0
    && items.length > 0 && items.length <= MAX_LINEAS
    && !cantidadesInvalidas
    && (modo === "inventario" || (items.length === 1 && diferencias === 1));
  const term = normalizeSearch(busqueda);
  const productos = stock?.filter(({ producto }) => matchesSearch(term, [producto.nombre, producto.sku])) ?? [];
  const paginacion = usePagedList(productos, 12, busqueda);

  function limpiarConteo() {
    setCantidades({});
    setMotivo("");
    setErrorGuardar("");
    setConflicto(false);
    pendiente.current = null;
  }

  function volverACargar() {
    limpiarConteo();
    setErrorDatos("");
    setStock(null);
    setIntento((n) => n + 1);
  }

  function cambiarModo(siguiente: ModoInventario) {
    if (modo === siguiente) return;
    setModo(siguiente);
    limpiarConteo();
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!puedeGuardar || enviando.current) return;
    const contenido = { tipo: modo, motivo: motivo.trim(), items };
    const firma = JSON.stringify(contenido);
    if (pendiente.current?.firma !== firma) pendiente.current = { firma, id: idOperacion() };
    enviando.current = true;
    setGuardando(true);
    setErrorGuardar("");
    try {
      const toma = await bodegasApi.registrarToma(bodega.id, { id: pendiente.current.id, ...contenido });
      toast.success(modo === "ajuste" ? "Ajuste de stock guardado" : "Toma de inventario guardada");
      setDetalle(toma);
      volverACargar();
    } catch (e) {
      setErrorGuardar(e instanceof ApiError ? e.message : "No se pudo confirmar el guardado. Reintenta con el mismo conteo.");
      if (e instanceof ApiError && e.status === 409) setConflicto(true);
    } finally {
      enviando.current = false;
      setGuardando(false);
    }
  }

  async function verDetalle(id: string) {
    setCargandoDetalle(id);
    try {
      setDetalle(await bodegasApi.detalleToma(bodega.id, id));
    } catch {
      toast.error("No se pudo cargar el detalle de la operación");
    } finally {
      setCargandoDetalle(null);
    }
  }

  if (errorDatos) return (
    <p role="alert" className="text-sm text-destructive">{errorDatos} <Button variant="link" onClick={volverACargar}>Reintentar</Button></p>
  );
  if (!stock) return (
    <>
      <p role="status" className="text-sm text-muted-foreground">Cargando existencias…</p>
      <DetalleToma detalle={detalle} cerrar={() => setDetalle(null)} />
    </>
  );

  return (
    <div className="space-y-7">
      {bodega.activo ? (
        <section aria-label="Registrar inventario">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" variant={modo === "inventario" ? "default" : "outline"} aria-pressed={modo === "inventario"} disabled={guardando} onClick={() => cambiarModo("inventario")}>
              <ClipboardCheck size={16} /> Toma de inventario
            </Button>
            <Button type="button" variant={modo === "ajuste" ? "default" : "outline"} aria-pressed={modo === "ajuste"} disabled={guardando} onClick={() => cambiarModo("ajuste")}>
              <SlidersHorizontal size={16} /> Ajuste puntual
            </Button>
          </div>
          <form onSubmit={guardar} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {modo === "inventario"
                ? "Ingresa la cantidad de cada producto que contaste. Los espacios vacíos conservan su stock y el cero registra un conteo de cero."
                : "Busca un producto e ingresa el stock final que debe quedar en la bodega."}
            </p>
            <div className="relative max-w-sm">
              <Search size={16} aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" aria-label="Buscar producto" placeholder="Buscar por nombre o SKU" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">En sistema</TableHead>
                  <TableHead className="min-w-28">{modo === "inventario" ? "Conteo físico" : "Stock final"}</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {paginacion.pageItems.map(({ producto, cantidad }) => {
                    const contado = cantidades[producto.id] ?? "";
                    const diferencia = cantidadValida.test(contado) ? Number(contado) - cantidad : null;
                    return (
                      <TableRow key={producto.id}>
                        <TableCell>
                          <div className="font-medium">{producto.nombre}</div>
                          <div className="font-mono text-xs text-muted-foreground">{producto.sku} · {producto.unidad.nombre}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatoCantidad.format(cantidad)}</TableCell>
                        <TableCell>
                          <Input
                            className="w-24 tabular-nums"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            aria-label={`${modo === "inventario" ? "Conteo físico" : "Stock final"} de ${producto.nombre}`}
                            placeholder="—"
                            disabled={guardando || conflicto}
                            value={contado}
                            onChange={(e) => {
                              const valor = e.target.value;
                              setCantidades((previas) => modo === "inventario" ? { ...previas, [producto.id]: valor } : { [producto.id]: valor });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{diferencia === null ? "—" : formatoDiferencia.format(diferencia)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {productos.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No hay productos que coincidan.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <DataPagination page={paginacion.page} pageSize={paginacion.pageSize} totalItems={paginacion.totalItems} onPageChange={paginacion.setPage} />
            <div className="rounded-lg bg-muted/55 p-4">
              <div className="max-w-lg space-y-1.5">
                <Label htmlFor="motivo-conteo">Motivo</Label>
                <Input id="motivo-conteo" maxLength={300} required disabled={guardando} placeholder={modo === "inventario" ? "Ej. Conteo de fin de mes" : "Ej. Corrección por merma"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              {items.length > MAX_LINEAS && <p role="alert" className="mt-3 text-sm text-destructive">Registra como máximo {MAX_LINEAS} productos por toma.</p>}
              {cantidadesInvalidas && <p role="alert" className="mt-3 text-sm text-destructive">Ingresa cantidades enteras entre 0 y {formatoCantidad.format(MAX_STOCK)}.</p>}
              {errorGuardar && <p role="alert" className="mt-3 text-sm text-destructive">{errorGuardar}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">{items.length} {items.length === 1 ? "producto contado" : "productos contados"} · {diferencias} {diferencias === 1 ? "diferencia" : "diferencias"}</p>
                {conflicto
                  ? <Button type="button" variant="outline" onClick={volverACargar}><RefreshCw size={16} /> Volver a contar</Button>
                  : <Button type="submit" disabled={!puedeGuardar}>{guardando ? "Guardando…" : modo === "inventario" ? "Guardar toma" : "Guardar ajuste"}</Button>}
              </div>
            </div>
          </form>
        </section>
      ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Esta bodega está inactiva. Puedes consultar sus tomas y ajustes anteriores.</p>}

      <section aria-labelledby="historial-tomas" className="space-y-3">
        <h2 id="historial-tomas" className="font-display text-lg font-bold">Últimas tomas y ajustes</h2>
        {historial.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay operaciones registradas para esta bodega.</p> : (
          <ul className="divide-y rounded-lg border">
            {historial.map((toma) => (
              <li key={toma.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{nombreOperacion[toma.tipo]} · {toma.motivo}</p>
                  <p className="text-xs text-muted-foreground">{formatoFecha.format(new Date(toma.fecha))} · {toma.usuarioNombre} · {toma.ajustes} de {toma.lineas} con diferencia</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={cargandoDetalle !== null} onClick={() => void verDetalle(toma.id)}>{cargandoDetalle === toma.id ? "Cargando…" : "Ver detalle"}</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <DetalleToma detalle={detalle} cerrar={() => setDetalle(null)} />
    </div>
  );
}

function DetalleToma({ detalle, cerrar }: { detalle: TomaInventario | null; cerrar: () => void }) {
  return (
    <Dialog open={!!detalle} onOpenChange={(open) => { if (!open) cerrar(); }}>
      {detalle && (
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{nombreOperacion[detalle.tipo]} · {detalle.bodegaNombre}</DialogTitle>
            <DialogDescription>{formatoFecha.format(new Date(detalle.fecha))} · {detalle.usuarioNombre}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{detalle.motivo}</p>
          <Table>
            <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Anterior</TableHead><TableHead className="text-right">Contado</TableHead><TableHead className="text-right">Diferencia</TableHead></TableRow></TableHeader>
            <TableBody>
              {detalle.items.map((item) => (
                <TableRow key={item.productoId}>
                  <TableCell><p>{item.nombre}</p><p className="text-xs text-muted-foreground">{item.sku} · {item.unidad}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad.format(item.stockEsperado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad.format(item.stockContado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoDiferencia.format(item.diferencia)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      )}
    </Dialog>
  );
}
