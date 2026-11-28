import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ArrowLeft, ChevronRight, ClipboardList, FileCheck, PackageCheck, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { cargarCatalogoCompras, comprasApi, estadosCompra, saldoRecepcion, type CatalogoCompras, type CompraSugerida, type DetalleCompra, type EstadoCompra, type OrdenCompra } from "@/api/compras";
import { ApiError } from "@/api/client";
import CompraFormDialog from "@/components/CompraFormDialog";
import CompraAccionDialog, { type Accion } from "@/components/CompraAccionDialog";
import DataPagination from "@/components/DataPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNegocio } from "@/context/NegocioContext";
import { fechaCompleta } from "@/lib/fechas";
import { centavosCosto, costoEnPesos } from "@/lib/formatCosto";
import { printCompra } from "@/lib/printCompra";

const formatoFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
const totalOrden = (orden: OrdenCompra) => orden.items.reduce((total, item) => total + centavosCosto(item.costoUnitario, item.cantidad), 0n);

function Estado({ estado }: { estado: EstadoCompra }) {
  const variantes = { borrador: "secondary", emitida: "outline", parcial: "outline", recibida: "default", cerrada: "secondary", anulada: "destructive" } as const;
  return <Badge variant={variantes[estado]}>{estadosCompra[estado]}</Badge>;
}

function VerCompra({ orden, editar, actuar }: {
  orden: DetalleCompra;
  editar: () => void;
  actuar: (accion: Accion) => void;
}) {
  const { negocio } = useNegocio();
  const borrador = orden.estado === "borrador";
  const admiteRecepcion = orden.estado === "emitida" || orden.estado === "parcial";
  const totalUnidades = orden.items.reduce((suma, item) => suma + item.cantidad, 0);
  const recibidas = orden.items.reduce((suma, item) => suma + item.recibida, 0);
  const porId = new Map(orden.items.map((item) => [item.id, item]));
  const porOperacion = new Map(orden.operaciones.map((op) => [op.id, op]));
  const devueltas = new Map<string, number>();
  for (const op of orden.operaciones.filter((op) => op.tipo === "devolucion")) {
    for (const item of op.items) devueltas.set(item.itemId, (devueltas.get(item.itemId) ?? 0) + item.cantidad);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5" aria-label="Resumen de la orden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold">Orden #{orden.folio}</h2><Estado estado={orden.estado} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatoFecha.format(new Date(orden.creadoEn))} · {orden.creadoPor}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {borrador && <Button variant="outline" onClick={editar}>Editar borrador</Button>}
            {borrador && <Button onClick={() => actuar({ tipo: "emitir" })}><FileCheck size={16} /> Emitir orden</Button>}
            {!borrador && <Button variant="outline" onClick={() => {
              if (!printCompra(orden, negocio)) toast.error("Habilita las ventanas emergentes para imprimir la orden.");
            }}><Printer size={16} /> Imprimir orden</Button>}
            {admiteRecepcion && <Button onClick={() => actuar({ tipo: "recibir" })}><ArrowDownToLine size={16} /> Registrar recepción</Button>}
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Proveedor</dt><dd className="font-medium">{orden.proveedorNombre}</dd></div>
          <div><dt className="text-muted-foreground">Bodega de destino</dt><dd className="font-medium">{orden.bodegaNombre}</dd></div>
          <div><dt className="text-muted-foreground">Entrega estimada</dt>
            <dd className="font-medium">{orden.entregaEstimada ? fechaCompleta(orden.entregaEstimada.slice(0, 10)) : "Sin fecha"}</dd></div>
          <div><dt className="text-muted-foreground">Importe de la orden</dt><dd className="font-semibold tabular-nums">{costoEnPesos(totalOrden(orden))}</dd></div>
        </dl>
        {orden.nota && <p className="text-sm"><strong>Observaciones</strong> · {orden.nota}</p>}
        {orden.motivoCierre && <p className="text-sm"><strong>Motivo</strong> · {orden.motivoCierre}</p>}
        {(admiteRecepcion || recibidas > 0) && (
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium">{recibidas} de {totalUnidades} unidades recibidas</p>
            <progress className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
              max={totalUnidades} value={recibidas} aria-label="Unidades recibidas" />
          </div>
        )}
      </section>
      <section aria-label="Detalle de productos">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Producto</TableHead><TableHead className="text-right">Pedidas</TableHead><TableHead className="text-right">Recibidas</TableHead>
            <TableHead className="text-right">Devueltas</TableHead><TableHead className="text-right">Por recibir</TableHead>
            <TableHead className="text-right">Costo unitario</TableHead><TableHead className="text-right">Importe</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {orden.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell><strong>{item.productoNombre}</strong><span className="block text-xs text-muted-foreground">{item.sku}</span></TableCell>
                <TableCell className="text-right tabular-nums">{item.cantidad}</TableCell>
                <TableCell className="text-right tabular-nums">{item.recibida}</TableCell>
                <TableCell className="text-right tabular-nums">{devueltas.get(item.id) ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{admiteRecepcion ? item.cantidad - item.recibida : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{costoEnPesos(centavosCosto(item.costoUnitario))}</TableCell>
                <TableCell className="text-right tabular-nums">{costoEnPesos(centavosCosto(item.costoUnitario, item.cantidad))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><PackageCheck size={18} /> Recepciones y devoluciones</h3>
        {orden.operaciones.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay recepciones ni devoluciones asociadas.</p>}
        {orden.operaciones.map((op) => (
          <article key={op.id} className="space-y-2 rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="font-medium">{op.tipo === "recepcion" ? "Recepción" : "Devolución"} · {op.documento}</h4>
                <p className="text-xs text-muted-foreground">{formatoFecha.format(new Date(op.fecha))} · {op.usuarioNombre}</p>
              </div>
              {op.tipo === "recepcion" && [...saldoRecepcion(orden, op).values()].some((cantidad) => cantidad > 0) &&
                <Button size="sm" variant="outline" onClick={() => actuar({ tipo: "devolver", recepcion: op })}>Devolver al proveedor</Button>}
            </div>
            {op.recepcionId && <p className="text-xs text-muted-foreground">Recepción original · {porOperacion.get(op.recepcionId)?.documento}</p>}
            {op.nota && <p className="text-sm">{op.nota}</p>}
            <ul className="space-y-1 text-sm">
              {op.items.map((item) => <li key={item.itemId}>{item.cantidad} × {porId.get(item.itemId)?.productoNombre}</li>)}
            </ul>
          </article>
        ))}
      </section>
      {(borrador || admiteRecepcion) && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {orden.estado === "parcial"
            ? <Button variant="outline" onClick={() => actuar({ tipo: "cerrar" })}>Cerrar saldo pendiente</Button>
            : <Button variant="ghost" className="text-destructive" onClick={() => actuar({ tipo: "anular" })}>Anular orden</Button>}
        </div>
      )}
    </div>
  );
}

export default function ComprasPage() {
  const [params, setParams] = useSearchParams();
  const ordenId = params.get("orden") ?? "";
  const location = useLocation();
  const navigate = useNavigate();
  const sugerida = (location.state as { sugerida?: CompraSugerida } | null)?.sugerida;
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ folio: "", estado: "", proveedorId: "", bodegaId: "" });
  const [recarga, setRecarga] = useState(0);
  const [catalogo, setCatalogo] = useState<CatalogoCompras | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [formulario, setFormulario] = useState<"nueva" | "editar" | null>(sugerida ? "nueva" : null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [detalle, setDetalle] = useState<DetalleCompra | null>(null);
  const [errorConsulta, setErrorConsulta] = useState<{ clave: string; mensaje: string } | null>(null);
  const [resultado, setResultado] = useState<{ clave: string; lista: Awaited<ReturnType<typeof comprasApi.listar>> } | null>(null);
  const filtroActivo = useMemo(() => {
    const query = new URLSearchParams({ pagina: String(pagina) });
    Object.entries(filtros).filter(([, valor]) => valor).forEach(([campo, valor]) => query.set(campo, valor));
    return query;
  }, [filtros, pagina]);
  const clave = `${recarga}|${ordenId || filtroActivo.toString()}`;
  const error = errorConsulta?.clave === clave ? errorConsulta.mensaje : "";
  const lista = resultado?.clave === clave ? resultado.lista : null;

  useEffect(() => {
    let vigente = true;
    cargarCatalogoCompras().then((data) => { if (vigente) setCatalogo(data); }).catch((e) => {
      if (vigente) setErrorCatalogo(e instanceof ApiError ? e.message : "No se pudieron cargar los catálogos.");
    });
    return () => { vigente = false; };
  }, [recarga]);

  useEffect(() => {
    let vigente = true;
    if (ordenId) {
      comprasApi.obtener(ordenId).then((data) => {
        if (!vigente) return;
        setErrorConsulta(null);
        setDetalle(data);
      }).catch((e) => {
        if (vigente) setErrorConsulta({ clave, mensaje: e instanceof ApiError ? e.message : "No se pudo abrir la orden." });
      });
    } else {
      const espera = window.setTimeout(() => {
        comprasApi.listar(filtroActivo).then((data) => {
          if (!vigente) return;
          setErrorConsulta(null);
          setResultado({ clave, lista: data });
        }).catch((e) => {
          if (vigente) setErrorConsulta({ clave, mensaje: e instanceof ApiError ? e.message : "No se pudieron cargar las compras." });
        });
      }, 150);
      return () => { vigente = false; window.clearTimeout(espera); };
    }
    return () => { vigente = false; };
  }, [ordenId, filtroActivo, clave]);

  const orden = detalle?.id === ordenId ? detalle : null;
  function cerrarFormulario() {
    setFormulario(null);
    if (sugerida) navigate(location.pathname + location.search, { replace: true, state: null });
  }

  function guardada(actualizada: DetalleCompra) {
    setFormulario(null);
    setAccion(null);
    setDetalle(actualizada);
    setErrorConsulta(null);
    setResultado(null);
    setParams({ orden: actualizada.id }, { replace: Boolean(sugerida), state: null });
    toast.success(`Orden #${actualizada.folio} actualizada`);
  }

  function filtrar(campo: keyof typeof filtros, valor: string) {
    setPagina(1);
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  }

  const select = "h-9 min-w-0 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      {ordenId ? (
        <>
          <Button variant="ghost" asChild><Link to="/compras"><ArrowLeft size={16} /> Volver a compras</Link></Button>
          {orden && <>
            <Button variant="ghost" onClick={() => setRecarga((n) => n + 1)}>Actualizar detalle</Button>
            <VerCompra orden={orden} editar={() => setFormulario("editar")} actuar={setAccion} />
          </>}
          {!orden && !error && <p role="status" className="text-sm text-muted-foreground">Cargando orden…</p>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(5rem,8rem)_repeat(3,minmax(8rem,1fr))]">
              <label className="grid gap-1 text-xs font-medium">Folio
                <Input type="text" inputMode="numeric" maxLength={10} placeholder="Ej. 123" value={filtros.folio}
                  onChange={(e) => filtrar("folio", e.target.value.replace(/\D/g, ""))} />
              </label>
              <label className="grid gap-1 text-xs font-medium">Estado
                <select aria-label="Estado" className={select} value={filtros.estado} onChange={(e) => filtrar("estado", e.target.value)}>
                  <option value="">Todos los estados</option>
                  {Object.entries(estadosCompra).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">Proveedor
                <select aria-label="Proveedor" className={select} value={filtros.proveedorId} onChange={(e) => filtrar("proveedorId", e.target.value)}>
                  <option value="">Todos los proveedores</option>
                  {catalogo?.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">Bodega
                <select aria-label="Bodega" className={select} value={filtros.bodegaId} onChange={(e) => filtrar("bodegaId", e.target.value)}>
                  <option value="">Todas las bodegas</option>
                  {catalogo?.bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </label>
            </div>
            <Button onClick={() => setFormulario("nueva")} disabled={!catalogo}><Plus size={16} /> Nueva orden</Button>
          </div>
          {lista && lista.ordenes.length > 0 && (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Orden</TableHead><TableHead>Proveedor</TableHead><TableHead>Bodega</TableHead>
                  <TableHead>Estado</TableHead><TableHead>Entrega estimada</TableHead><TableHead className="text-right">Importe</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {lista.ordenes.map((orden) => (
                    <TableRow key={orden.id}>
                      <TableCell>
                        <Link to={`/compras?orden=${orden.id}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                          #{orden.folio} <ChevronRight size={14} aria-hidden />
                        </Link>
                        <span className="block text-xs text-muted-foreground">{formatoFecha.format(new Date(orden.creadoEn))}</span>
                      </TableCell>
                      <TableCell>{orden.proveedorNombre}</TableCell><TableCell>{orden.bodegaNombre}</TableCell>
                      <TableCell><Estado estado={orden.estado} /></TableCell>
                      <TableCell>{orden.entregaEstimada ? fechaCompleta(orden.entregaEstimada.slice(0, 10)) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{costoEnPesos(totalOrden(orden))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataPagination page={pagina} totalItems={lista.total} pageSize={lista.porPagina} onPageChange={setPagina} />
            </>
          )}
          {lista?.ordenes.length === 0 && (
            <div className="grid justify-items-center gap-2 rounded-lg border border-dashed p-10 text-center">
              <ClipboardList size={28} className="text-muted-foreground" aria-hidden />
              <p className="font-medium">No hay órdenes que coincidan.</p>
            </div>
          )}
          {!lista && !error && <p role="status" className="text-sm text-muted-foreground">Cargando compras…</p>}
        </>
      )}
      {(error || errorCatalogo) && <p role="alert" className="text-sm text-destructive">{error || errorCatalogo}{" "}
        <button type="button" className="underline" onClick={() => { setErrorCatalogo(""); setRecarga((n) => n + 1); }}>Reintentar</button>
      </p>}
      {formulario && catalogo && <CompraFormDialog catalogo={catalogo} orden={formulario === "editar" ? orden ?? undefined : undefined}
        sugerida={sugerida} onClose={cerrarFormulario} onSave={guardada} />}
      {accion && orden && <CompraAccionDialog orden={orden} accion={accion} onClose={() => setAccion(null)} onSave={guardada} />}
    </div>
  );
}
