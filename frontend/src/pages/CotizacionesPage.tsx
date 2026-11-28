import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { cotizacionesApi, estadosCotizacion, type Cotizacion } from "@/api/cotizaciones";
import { ApiError } from "@/api/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataPagination from "@/components/DataPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNegocio } from "@/context/NegocioContext";
import { fechaCompleta } from "@/lib/fechas";
import { money } from "@/lib/format";
import { folioComprobante, printCotizacion } from "@/lib/printTicket";

export default function CotizacionesPage() {
  const { negocio } = useNegocio();
  const [params, setParams] = useSearchParams();
  const id = params.get("detalle");
  const [filtros, setFiltros] = useState({ q: "", estado: "" });
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; data?: Awaited<ReturnType<typeof cotizacionesApi.listar>>; error?: string }>();
  const [detalle, setDetalle] = useState<Cotizacion | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<{ id: string; mensaje: string }>();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const query = useMemo(() => {
    const query = new URLSearchParams({ pagina: String(pagina) });
    if (/^#\d+$/.test(filtros.q.trim())) query.set("folio", filtros.q.trim().slice(1));
    else if (filtros.q.trim()) query.set("q", filtros.q.trim());
    if (filtros.estado) query.set("estado", filtros.estado);
    return query;
  }, [filtros, pagina]);
  const clave = `${recarga}|${query}`;
  const lista = resultado?.clave === clave ? resultado : undefined;
  const seleccionada = detalle?.id === id ? detalle : null;

  useEffect(() => {
    let vigente = true;
    const timer = window.setTimeout(() => {
      cotizacionesApi.listar(query).then((data) => { if (vigente) setResultado({ clave, data }); }).catch((e) => {
        if (vigente) setResultado({ clave, error: e instanceof ApiError ? e.message : "No se pudieron cargar las cotizaciones" });
      });
    }, 150);
    return () => { vigente = false; window.clearTimeout(timer); };
  }, [query, clave]);

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    cotizacionesApi.obtener(id).then((data) => {
      if (vigente) { setDetalle(data); setErrorDetalle(undefined); }
    }).catch((e) => {
      if (vigente) setErrorDetalle({ id, mensaje: e instanceof ApiError ? e.message : "No se pudo abrir la cotización" });
    });
    return () => { vigente = false; };
  }, [id, recarga]);

  async function anular() {
    if (!seleccionada || ocupado) return;
    setConfirmar(false);
    setOcupado(true);
    try {
      setDetalle(await cotizacionesApi.anular(seleccionada.id));
      setRecarga((n) => n + 1);
      toast.success("Cotización anulada");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo anular la cotización");
    } finally { setOcupado(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-40 flex-1 gap-1 text-xs font-medium">Buscar cotizaciones
          <Input maxLength={100} placeholder="Cliente o #folio" value={filtros.q}
            onChange={(e) => { setFiltros({ ...filtros, q: e.target.value }); setPagina(1); }} />
        </label>
        <label className="grid gap-1 text-xs font-medium">Estado
          <select aria-label="Estado" className="h-9 rounded-md border bg-background px-2 text-sm" value={filtros.estado}
            onChange={(e) => { setFiltros({ ...filtros, estado: e.target.value }); setPagina(1); }}>
            <option value="">Todos</option>
            {Object.entries(estadosCotizacion).map(([valor, nombre]) => <option value={valor} key={valor}>{nombre}</option>)}
          </select>
        </label>
        <Button asChild><Link to="/caja?modo=cotizar"><Plus size={16} /> Nueva cotización</Link></Button>
      </div>
      {!lista && <p role="status" className="text-sm text-muted-foreground">Cargando cotizaciones…</p>}
      {lista?.error && <p role="alert" className="text-sm text-destructive">{lista.error}{" "}
        <button type="button" className="underline" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button></p>}
      {lista?.data && (lista.data.filas.length > 0 ? <>
        <Table>
          <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead>Válida hasta</TableHead>
            <TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>{lista.data.filas.map((fila) => <TableRow key={fila.id}>
            <TableCell><Link className="font-semibold text-primary underline" to={`?detalle=${fila.id}`}>#{fila.folio}</Link></TableCell>
            <TableCell>{fila.clienteNombre}</TableCell><TableCell>{fechaCompleta(fila.vigenteHasta)}</TableCell>
            <TableCell><Badge variant={fila.estado === "vigente" ? "default" : "outline"}>{estadosCotizacion[fila.estado]}</Badge></TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(fila.total)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <DataPagination page={pagina} pageSize={lista.data.porPagina} totalItems={lista.data.total} onPageChange={setPagina} />
      </> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {lista.data.total ? "Esta página quedó vacía." : "No hay cotizaciones para estos filtros."}
        {lista.data.total > 0 && <button type="button" onClick={() => setPagina(1)} className="ml-2 underline">Volver a la primera página</button>}
      </p>)}
      <Dialog open={Boolean(id)} onOpenChange={(open) => { if (!open && !ocupado) setParams({}); }}>
        <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{seleccionada ? `Cotización #${seleccionada.folio}` : "Cotización"}</DialogTitle>
            <DialogDescription>{seleccionada ? `${seleccionada.clienteNombre} · Válida hasta el ${fechaCompleta(seleccionada.vigenteHasta)}` : "Detalle de la propuesta comercial."}</DialogDescription>
          </DialogHeader>
          {!seleccionada && <p role="status" className="text-sm text-muted-foreground">{errorDetalle?.id === id ? errorDetalle?.mensaje : "Cargando detalle…"}</p>}
          {seleccionada && <>
            <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline">{estadosCotizacion[seleccionada.estado]}</Badge>
              {seleccionada.venta && <span className="text-muted-foreground">Venta {folioComprobante(seleccionada.venta.id)}</span>}</div>
            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
              <TableBody>{seleccionada.items.map((item, i) => <TableRow key={i}>
                <TableCell>{item.nombre}</TableCell><TableCell className="text-right">{item.cantidad}</TableCell>
                <TableCell className="text-right">{money(item.precio / 100)}</TableCell>
                <TableCell className="text-right">{money((item.precio * item.cantidad - item.descuento) / 100)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
            {seleccionada.observaciones && <p className="break-words text-sm text-muted-foreground">{seleccionada.observaciones}</p>}
            <div className="rounded-lg border bg-muted p-3 text-sm">
              {seleccionada.descuento > 0 && <p className="flex justify-between"><span>Descuento global</span><span>−{money(seleccionada.descuento)}</span></p>}
              <p className="flex justify-between font-semibold"><span>Total cotizado</span><span>{money(seleccionada.total)}</span></p>
            </div>
            <DialogFooter>
              {seleccionada.estado === "vigente" && <>
                <Button disabled={ocupado} variant="ghost" className="text-destructive" onClick={() => setConfirmar(true)}>Anular</Button>
                <Button asChild><Link to={`/caja?cotizacion=${seleccionada.id}`}><ShoppingCart size={16} /> Cobrar en caja</Link></Button>
              </>}
              <Button variant="outline" onClick={() => { if (!printCotizacion(seleccionada, negocio)) toast.error("Habilita las ventanas emergentes para imprimir"); }}>
                <Printer size={16} /> Imprimir
              </Button>
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmar} title="¿Anular cotización?" message="La cotización quedará en el historial y se cerrará para cobro."
        confirmLabel="Anular cotización" onCancel={() => setConfirmar(false)} onConfirm={anular} />
    </div>
  );
}
