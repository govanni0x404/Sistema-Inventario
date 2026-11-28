import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, Boxes, ChartNoAxesColumnIncreasing, ClipboardList, Pencil, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { bodegasApi } from "@/api/bodegas";
import { categoriasApi } from "@/api/categorias";
import { planificacionApi, type ExistenciaPlanificada } from "@/api/planificacion";
import { proveedoresApi } from "@/api/proveedores";
import type { CompraSugerida } from "@/api/compras";
import DataPagination from "@/components/DataPagination";
import { tieneAcceso } from "@/components/nav-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { exportarCsv } from "@/lib/exportCsv";
import { hoyStr } from "@/lib/fechas";
import { centavosCosto, costoEnPesos } from "@/lib/formatCosto";

const MAX = 2_147_483_647;
const formatoNumero = new Intl.NumberFormat("es-CL");
const numero = (valor: string | number) => formatoNumero.format(BigInt(valor));
const moneda = (valor: string) => costoEnPesos(centavosCosto(valor));

function MinimoDialog({ fila, onClose, onSave }: {
  fila: ExistenciaPlanificada;
  onClose: () => void;
  onSave: () => void;
}) {
  const [minimo, setMinimo] = useState(fila.minimoConfigurado?.toString() ?? "");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      await planificacionApi.minimo(fila, minimo === "" ? null : Number(minimo));
      onSave();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar el mínimo.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !ocupado) onClose(); }}>
      <DialogContent showCloseButton={!ocupado}>
        <DialogHeader>
          <DialogTitle>Mínimo por bodega</DialogTitle>
          <DialogDescription>{fila.productoNombre} · {fila.bodegaNombre}. Si dejas el campo vacío se usa el valor predeterminado de esa bodega.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado} className="space-y-4">
            <label className="grid gap-1.5 text-sm font-medium">Unidades mínimas
              <Input type="number" min={0} max={MAX} step={1} value={minimo}
                placeholder={fila.minimoConfigurado === null ? String(fila.minimo) : "Valor predeterminado"}
                onChange={(e) => setMinimo(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit">{ocupado ? "Guardando…" : "Guardar mínimo"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function cargarFiltros() {
  const [bodegas, categorias, proveedores] = await Promise.all([
    bodegasApi.listar(), categoriasApi.listar(), proveedoresApi.listar(),
  ]);
  return { bodegas, categorias, proveedores };
}

export default function PlanificacionPage() {
  const { usuario } = useAuth();
  const puedeComprar = tieneAcceso(usuario, { seccion: "compras" });
  const [catalogos, setCatalogos] = useState<Awaited<ReturnType<typeof cargarFiltros>> | null>(null);
  const [filtros, setFiltros] = useState({ q: "", bodegaId: "", categoriaId: "", proveedorId: "", estado: "" });
  const [recarga, setRecarga] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ clave: string; datos: Awaited<ReturnType<typeof planificacionApi.listar>> } | null>(null);
  const [errorConsulta, setErrorConsulta] = useState<{ clave: string; mensaje: string } | null>(null);
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [editando, setEditando] = useState<ExistenciaPlanificada | null>(null);
  const [exportando, setExportando] = useState(false);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filtros).filter(([, valor]) => valor.trim()).forEach(([campo, valor]) => params.set(campo, valor.trim()));
    return params;
  }, [filtros]);
  const clave = `${recarga}|${pagina}|${query}`;
  const error = errorConsulta?.clave === clave ? errorConsulta.mensaje : "";
  const informe = resultado?.clave === clave ? resultado.datos : null;

  useEffect(() => {
    let vigente = true;
    cargarFiltros().then((datos) => { if (vigente) setCatalogos(datos); }).catch(() => {
      if (vigente) setErrorCatalogos("No se pudieron cargar los filtros de bodega, categoría y proveedor.");
    });
    return () => { vigente = false; };
  }, [recarga]);

  useEffect(() => {
    let vigente = true;
    const espera = window.setTimeout(() => {
      const params = new URLSearchParams(query);
      params.set("pagina", String(pagina));
      planificacionApi.listar(params).then((datos) => {
        if (vigente) {
          const ultimaPagina = Math.max(1, Math.ceil(datos.resumen.total / datos.filasPorPagina));
          if (pagina > ultimaPagina) setPagina(ultimaPagina);
          else {
            setErrorConsulta(null);
            setResultado({ clave, datos });
          }
        }
      }).catch((e) => {
        if (vigente) setErrorConsulta({ clave, mensaje: e instanceof ApiError ? e.message : "No se pudo cargar el informe." });
      });
    }, 180);
    return () => { vigente = false; window.clearTimeout(espera); };
  }, [query, pagina, clave]);

  function filtrar(campo: keyof typeof filtros, valor: string) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
    setPagina(1);
  }

  async function descargar() {
    setExportando(true);
    try {
      const filas = await planificacionApi.exportar(query);
      exportarCsv(`reposicion-valorizacion-${hoyStr()}.csv`, filas.map((fila) => ({
        Producto: fila.productoNombre, Código: fila.codigoBarras ?? fila.sku, Categoría: fila.categoria,
        Bodega: fila.bodegaNombre, Proveedor: fila.proveedorNombre, Existencias: fila.cantidad, Mínimo: fila.minimo,
        "Compra pendiente": BigInt(fila.pendiente), "Compra sugerida": BigInt(fila.sugerido),
        "Costo unitario (CLP)": Number(fila.costoUnitario),
        "Valor (CLP)": fila.valor.includes(".") ? Number(fila.valor) : BigInt(fila.valor),
      })));
      if (!filas.length) toast.info("No hay filas para exportar con estos filtros.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo exportar el informe.");
    } finally {
      setExportando(false);
    }
  }

  const select = "h-9 min-w-0 rounded-md border bg-background px-2 text-sm";
  const filtrosAdicionales = Number(Boolean(filtros.categoriaId)) + Number(Boolean(filtros.proveedorId));
  const indicadores = informe ? [
    { titulo: "Existencias", valor: numero(informe.resumen.unidades), icono: Boxes },
    { titulo: "Valor al costo de catálogo", valor: moneda(informe.resumen.valor), icono: ChartNoAxesColumnIncreasing },
    { titulo: "Productos por reponer por bodega", valor: numero(informe.resumen.reponer), icono: ClipboardList },
    { titulo: "Saldos negativos", valor: numero(informe.resumen.negativos), icono: AlertTriangle },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1.4fr)_repeat(2,minmax(8rem,1fr))]">
        <label className="grid gap-1 text-xs font-medium">Producto
          <span className="relative">
            <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground" />
            <Input className="pl-9" maxLength={100} placeholder="Nombre o código" value={filtros.q} onChange={(e) => filtrar("q", e.target.value)} />
          </span>
        </label>
        <label className="grid gap-1 text-xs font-medium">Bodega
          <select aria-label="Bodega" className={select} value={filtros.bodegaId} onChange={(e) => filtrar("bodegaId", e.target.value)}>
            <option value="">Todas las bodegas</option>
            {catalogos?.bodegas.map((b) => <option value={b.id} key={b.id}>{b.nombre}{b.activo ? "" : " (inactiva)"}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Situación
          <select aria-label="Situación" className={select} value={filtros.estado} onChange={(e) => filtrar("estado", e.target.value)}>
            <option value="">Todas</option><option value="reponer">Por reponer</option><option value="faltante">Sin existencias</option>
            <option value="negativo">Stock negativo</option><option value="sin_costo">Existencias sin costo</option>
          </select>
        </label>
      </div>
      <details className="rounded-lg border bg-muted/20 px-3 py-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium marker:content-none">
          <SlidersHorizontal size={15} className="text-primary" aria-hidden="true" />
          Más filtros {filtrosAdicionales > 0 && <Badge variant="secondary">{filtrosAdicionales}</Badge>}
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium">Categoría
            <select aria-label="Categoría" className={select} value={filtros.categoriaId} onChange={(e) => filtrar("categoriaId", e.target.value)}>
              <option value="">Todas las categorías</option>
              {catalogos?.categorias.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">Proveedor habitual
            <select aria-label="Proveedor habitual" className={select} value={filtros.proveedorId} onChange={(e) => filtrar("proveedorId", e.target.value)}>
              <option value="">Todos los proveedores</option>
              {catalogos?.proveedores.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        </div>
      </details>
      {(error || errorCatalogos) && <p role="alert" className="text-sm text-destructive">{error || errorCatalogos}{" "}
        <button type="button" className="underline" onClick={() => { setErrorCatalogos(""); setRecarga((n) => n + 1); }}>Reintentar</button>
      </p>}
      {!informe && !error && <p role="status" className="text-sm text-muted-foreground">Calculando existencias y reposición…</p>}
      {informe && (
        <>
          <dl className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {indicadores.map(({ titulo, valor, icono: Icono }) => (
              <div key={titulo} className="rounded-lg border bg-muted/20 p-3">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icono size={16} className="shrink-0 text-primary" />{titulo}</dt>
                <dd className="mt-1 break-words font-display text-xl font-semibold tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">La compra sugerida cubre el mínimo después de descontar las unidades que ya vienen en camino.</p>
            <Button variant="outline" onClick={descargar} disabled={!informe.resumen.total || exportando}>
              <ArrowDownToLine size={16} /> {exportando ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>
          {informe.filas.length === 0
            ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay existencias que coincidan con los filtros.</p>
            : <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Producto</TableHead><TableHead>Bodega</TableHead><TableHead className="text-right">Existencias</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Por recibir</TableHead>
                  <TableHead className="text-right">Comprar</TableHead><TableHead className="text-right">Valorización</TableHead>
                  {puedeComprar && <TableHead className="text-right">Acción</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {informe.filas.map((fila) => {
                    const sugerida: CompraSugerida = {
                      productoId: fila.productoId, bodegaId: fila.bodegaId, proveedorId: fila.proveedorId, cantidad: Math.min(Number(fila.sugerido), MAX),
                    };
                    return (
                      <TableRow key={fila.id}>
                        <TableCell>
                          <span className="font-semibold">{fila.productoNombre}</span>
                          <span className="block text-xs text-muted-foreground">{fila.codigoBarras ?? fila.sku}{fila.categoria ? ` · ${fila.categoria}` : ""}</span>
                          {fila.proveedorNombre && <span className="block text-xs text-muted-foreground">{fila.proveedorNombre}</span>}
                          {!fila.productoOperativo && <Badge variant="secondary" className="mt-1">Fuera de operación</Badge>}
                        </TableCell>
                        <TableCell>{fila.bodegaNombre}{!fila.bodegaActiva && <span className="block text-xs text-muted-foreground">Inactiva</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fila.cantidad <= 0 ? <Badge variant={fila.cantidad < 0 ? "destructive" : "secondary"}>{numero(fila.cantidad)}</Badge> : numero(fila.cantidad)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fila.bodegaActiva && fila.productoOperativo ? (
                            <Button variant="ghost" size="sm" aria-label={`Editar mínimo de ${fila.productoNombre} en ${fila.bodegaNombre}`}
                              title={fila.minimoConfigurado === null ? "Mínimo predeterminado" : "Mínimo configurado en esta bodega"}
                              onClick={() => setEditando(fila)}>{numero(fila.minimo)} <Pencil size={13} /></Button>
                          ) : numero(fila.minimo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{numero(fila.pendiente)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fila.sugerido !== "0" ? <Badge>{numero(fila.sugerido)}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="font-semibold">{moneda(fila.valor)}</span>
                          <span className="block text-xs text-muted-foreground">{moneda(fila.costoUnitario)} por unidad</span>
                        </TableCell>
                        {puedeComprar && <TableCell className="text-right">
                          {sugerida.cantidad > 0 && (
                            <Button asChild size="sm" variant="outline">
                              <Link to="/compras" state={{ sugerida }} aria-label={`Crear orden para ${fila.productoNombre} en ${fila.bodegaNombre}`}>Crear orden</Link>
                            </Button>
                          )}
                        </TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DataPagination page={pagina} pageSize={informe.filasPorPagina} totalItems={informe.resumen.total} onPageChange={setPagina} />
            </>}
        </>
      )}
      {editando && <MinimoDialog fila={editando} onClose={() => setEditando(null)} onSave={() => {
        setEditando(null);
        setRecarga((n) => n + 1);
        toast.success("Mínimo de bodega actualizado");
      }} />}
    </div>
  );
}
