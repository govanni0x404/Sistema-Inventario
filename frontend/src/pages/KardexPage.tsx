import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { bodegasApi } from "@/api/bodegas";
import { ApiError } from "@/api/client";
import { movimientosApi } from "@/api/movimientos";
import DataPagination from "@/components/DataPagination";
import RangoFechasSelector, { type RangoPreset } from "@/components/RangoFechasSelector";
import { tieneAcceso } from "@/components/nav-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { exportarCsv } from "@/lib/exportCsv";
import { hoyStr, validarRango } from "@/lib/fechas";
import type { Bodega } from "@/types/bodega";
import { causasMerma, origenesMovimiento, type MovimientoKardex } from "@/types/movimiento";
import { centavosCosto, costoEnPesos } from "@/lib/formatCosto";

const fecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
const numero = new Intl.NumberFormat("es-CL");

function ambitoSaldo(fila: MovimientoKardex) {
  return ["transferencia", "compra", "devolucion_compra", "saldo_inicial"].includes(fila.origen)
    ? "Bodega" : "Stock total";
}

function valorMermaParaCsv(fila: MovimientoKardex) {
  if (fila.costoMerma == null) return null;
  const centavos = centavosCosto(fila.costoMerma, fila.cantidad);
  return `${centavos / 100n}.${String(centavos % 100n).padStart(2, "0")}`;
}

export default function KardexPage() {
  const { usuario } = useAuth();
  const verCompras = tieneAcceso(usuario, { seccion: "compras" });
  const [url, setUrl] = useSearchParams();
  const productoId = url.get("productoId");
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [filtros, setFiltros] = useState({ bodegaId: "", tipo: "", origen: url.get("origen") === "merma" ? "merma" : "", q: "", causaMerma: "" });
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desde, setDesde] = useState(hoyStr);
  const [hasta, setHasta] = useState(hoyStr);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; data: Awaited<ReturnType<typeof movimientosApi.kardex>> } | null>(null);
  const [fallo, setFallo] = useState<{ clave: string; mensaje: string } | null>(null);
  const [exportando, setExportando] = useState(false);
  const rangoInvalido = rango === "custom" ? validarRango(desde, hasta) : null;
  const query = useMemo(() => {
    const params = new URLSearchParams(rango === "custom" ? { desde, hasta } : { dias: rango });
    if (productoId) params.set("productoId", productoId);
    Object.entries(filtros).filter(([, valor]) => valor.trim()).forEach(([campo, valor]) => params.set(campo, valor.trim()));
    return params;
  }, [rango, desde, hasta, filtros, productoId]);
  const clave = `${pagina}|${recarga}|${query}`;
  const kardex = resultado?.clave === clave ? resultado.data : null;
  const error = rangoInvalido || (fallo?.clave === clave ? fallo.mensaje : "");

  useEffect(() => {
    let vigente = true;
    bodegasApi.listar().then((data) => {
      if (vigente) setBodegas(data);
    }).catch(() => {
      if (vigente) setErrorCatalogo("No se pudieron cargar las bodegas.");
    });
    return () => { vigente = false; };
  }, [recarga]);

  useEffect(() => {
    if (rangoInvalido) return;
    let vigente = true;
    const espera = window.setTimeout(() => {
      const params = new URLSearchParams(query);
      params.set("pagina", String(pagina));
      movimientosApi.kardex(params).then((data) => {
        if (!vigente) return;
        const ultimaPagina = Math.max(1, Math.ceil(data.total / data.porPagina));
        if (pagina > ultimaPagina) setPagina(ultimaPagina);
        else {
          setFallo(null);
          setResultado({ clave, data });
        }
      }).catch((e) => {
        if (vigente) setFallo({ clave, mensaje: e instanceof ApiError ? e.message : "No se pudo cargar el kárdex." });
      });
    }, 150);
    return () => { vigente = false; window.clearTimeout(espera); };
  }, [query, pagina, clave, rangoInvalido]);

  function filtrar(campo: keyof typeof filtros, valor: string) {
    setPagina(1);
    setFiltros((actual) => ({ ...actual, [campo]: valor, ...(campo === "origen" && valor !== "merma" && { causaMerma: "" }) }));
  }

  async function exportar() {
    setExportando(true);
    try {
      const filas = await movimientosApi.exportarKardex(query);
      exportarCsv(`kardex-${hoyStr()}.csv`, filas.map((fila) => ({
        Fecha: fecha.format(new Date(fila.fecha)), Producto: fila.producto.nombre, Código: fila.producto.codigoBarras,
        Bodega: fila.bodega?.nombre, Origen: origenesMovimiento[fila.origen] ?? fila.origen,
        Entrada: fila.tipo === "entrada" ? fila.cantidad : 0, Salida: fila.tipo === "salida" ? fila.cantidad : 0,
        Unidad: fila.producto.unidad.nombre, "Saldo registrado": fila.stockResultante, "Ámbito del saldo": ambitoSaldo(fila),
        Usuario: fila.usuario?.nombre, Documento: fila.operacionCompra?.documento, Motivo: fila.motivo,
        "Causa de merma": fila.causaMerma ? causasMerma[fila.causaMerma] : null,
        "Costo de la merma (CLP)": valorMermaParaCsv(fila),
      })));
      if (!filas.length) toast.info("No hay movimientos para exportar.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo exportar el kárdex.");
    } finally {
      setExportando(false);
    }
  }

  const select = "h-9 min-w-0 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RangoFechasSelector rango={rango} setRango={(valor) => { setRango(valor); setPagina(1); }}
          desdeCustom={desde} setDesdeCustom={(valor) => { setDesde(valor); setPagina(1); }}
          hastaCustom={hasta} setHastaCustom={(valor) => { setHasta(valor); setPagina(1); }} />
        <Button variant="outline" onClick={exportar} disabled={!kardex?.total || exportando}><Download size={16} /> {exportando ? "Exportando…" : "Exportar CSV"}</Button>
      </div>
      {filtros.origen === "merma" && <label className="grid max-w-56 gap-1 text-xs font-medium">Causa de merma
        <select aria-label="Causa de merma" className={select} value={filtros.causaMerma} onChange={(e) => filtrar("causaMerma", e.target.value)}>
          <option value="">Todas las causas</option>
          {Object.entries(causasMerma).map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}
        </select>
      </label>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1.4fr)_repeat(3,minmax(7rem,1fr))]">
        <label className="grid gap-1 text-xs font-medium">Producto
          <span className="relative">
            <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground" />
            <Input className="pl-9" maxLength={100} placeholder="Nombre o código" value={filtros.q} onChange={(e) => filtrar("q", e.target.value)} />
          </span>
        </label>
        <label className="grid gap-1 text-xs font-medium">Bodega
          <select aria-label="Bodega" className={select} value={filtros.bodegaId} onChange={(e) => filtrar("bodegaId", e.target.value)}>
            <option value="">Todas las bodegas</option>
            {bodegas.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Tipo de movimiento
          <select aria-label="Tipo de movimiento" className={select} value={filtros.tipo} onChange={(e) => filtrar("tipo", e.target.value)}>
            <option value="">Entradas y salidas</option><option value="entrada">Entradas</option><option value="salida">Salidas</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Origen
          <select aria-label="Origen" className={select} value={filtros.origen} onChange={(e) => filtrar("origen", e.target.value)}>
            <option value="">Todos los orígenes</option>
            {Object.entries(origenesMovimiento).map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}
          </select>
        </label>
      </div>
      {productoId && <Button variant="outline" size="sm" onClick={() => { setUrl({}); setPagina(1); }}>Quitar filtro de producto</Button>}
      {(error || errorCatalogo) && <p role="alert" className="text-sm text-destructive">{error || errorCatalogo}{" "}
        {!rangoInvalido && <button type="button" className="underline" onClick={() => { setErrorCatalogo(""); setRecarga((n) => n + 1); }}>Reintentar</button>}
      </p>}
      {!kardex && !error && <p role="status" className="text-sm text-muted-foreground">Cargando movimientos…</p>}
      {kardex && <>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{numero.format(kardex.total)} {kardex.total === 1 ? "movimiento" : "movimientos"}</Badge>
          <Badge variant="secondary">Entradas · {numero.format(kardex.entradas)}</Badge>
          <Badge variant="secondary">Salidas · {numero.format(kardex.salidas)}</Badge>
          {kardex.valorMermas !== undefined && <Badge variant="outline">Costo de mermas · {costoEnPesos(centavosCosto(kardex.valorMermas))}</Badge>}
        </div>
        {kardex.filas.length === 0
          ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay movimientos que coincidan con los filtros.</p>
          : <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Bodega</TableHead><TableHead>Origen</TableHead>
              <TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Saldo registrado</TableHead><TableHead>Usuario</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {kardex.filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{fecha.format(new Date(fila.fecha))}</TableCell>
                  <TableCell><strong>{fila.producto.nombre}</strong><span className="block text-xs text-muted-foreground">{fila.producto.codigoBarras}</span></TableCell>
                  <TableCell>{fila.bodega?.nombre ?? "—"}</TableCell>
                  <TableCell className="min-w-44 whitespace-normal">
                    <span className="font-medium">{origenesMovimiento[fila.origen] ?? fila.origen}</span>
                    {fila.causaMerma && <span className="block text-xs text-muted-foreground">{causasMerma[fila.causaMerma]}
                      {fila.costoMerma && ` · ${costoEnPesos(centavosCosto(fila.costoMerma, fila.cantidad))}`}</span>}
                    {fila.motivo && (fila.operacionCompra && verCompras
                      ? <Link className="block break-words text-xs text-primary underline" to={`/compras?orden=${fila.operacionCompra.ordenId}`}>{fila.motivo}</Link>
                      : <span className="block break-words text-xs text-muted-foreground">{fila.motivo}</span>)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge variant={fila.tipo === "entrada" ? "secondary" : "outline"}>{fila.tipo === "entrada" ? "+" : "−"}{numero.format(fila.cantidad)}</Badge>
                    <span className="block text-xs text-muted-foreground">{fila.producto.unidad.nombre}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{numero.format(fila.stockResultante)}
                    <span className="block text-xs text-muted-foreground">{ambitoSaldo(fila)}</span>
                  </TableCell>
                  <TableCell>{fila.usuario?.nombre ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
        <DataPagination page={pagina} pageSize={kardex.porPagina} totalItems={kardex.total} onPageChange={setPagina} />
      </>}
    </div>
  );
}
