import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PropsWithChildren } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Clock, CreditCard, Gift, Inbox, LogOut, Pencil, Plus, Printer, Receipt, Send, Settings2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { productosApi } from "../api/productos";
import { clientesApi } from "../api/clientes";
import { ventasApi } from "../api/ventas";
import { turnosApi } from "../api/turnos";
import { ventasEnEsperaApi } from "../api/ventasEnEspera";
import { listasPrecioApi } from "../api/listasPrecio";
import { ApiError } from "../api/client";
import type { Producto } from "../types/producto";
import type { Cliente } from "../types/cliente";
import { ETIQUETAS_PAGO, type MetodoPago, type Venta, type VentaInput } from "../types/venta";
import { DOCUMENTOS_VENTA, type DocumentoVenta } from "../types/negocio";
import type { TurnoCaja } from "../types/turno";
import type { VentaEnEspera } from "../types/ventaEnEspera";
import type { ListaPrecio } from "../types/listaPrecio";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AbrirTurnoCard from "../components/AbrirTurnoCard";
import CajaBusqueda from "../components/CajaBusqueda";
import CajaGrilla from "../components/CajaGrilla";
import CajaCliente from "../components/CajaCliente";
import CajaDescuentoDialog from "../components/CajaDescuentoDialog";
import CerrarTurnoDialog from "../components/CerrarTurnoDialog";
import VentasEnEsperaDialog from "../components/VentasEnEsperaDialog";
import MovimientoCajaDialog from "../components/MovimientoCajaDialog";
import { folioComprobante, printTicket } from "../lib/printTicket";
import { useNegocio } from "../context/NegocioContext";
import { useAuth } from "../context/AuthContext";
import { tieneAcceso } from "../components/nav-data";
import { aCentavos, LOCALE, moneyCaja as money, montoInput } from "../lib/format";
import { matchesSearch, normalizeSearch } from "../lib/search";


type CartItem = { id: string; productoId: string; nombre: string; precioBase: number; cantidad: number; descuento: number };

const METODOS = ["efectivo", "debito", "credito", "transferencia", "cortesia"] as const;
type MedioCaja = (typeof METODOS)[number];
const LISTA_BASE = "__base__";
const SIN_OVERRIDES: Record<string, number> = {};
const CLAVE_CAJA = "inventario_caja_actual";
const MAX_CANTIDAD = 2_147_483_647;

function CajaLayout({ children, operativa = false }: PropsWithChildren<{ operativa?: boolean }>) {
  return (
    <div className={operativa
      ? "caja-vista-fija flex min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3"
      : "w-full p-2 sm:p-3"}>
      <h1 className={operativa ? "sr-only" : "mb-5 shrink-0 font-display text-3xl leading-tight font-bold tracking-[-0.04em] sm:text-4xl"}>Caja</h1>
      {children}
    </div>
  );
}

function nuevaClaveVenta() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function CajaPage() {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [vistaCompacta, setVistaCompacta] = useState<"productos" | "pago">("productos");
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [pagos, setPagos] = useState<{ metodoPago: MetodoPago; monto: number }[]>([]);
  const [medio, setMedio] = useState<MedioCaja>("efectivo");
  const [montoPago, setMontoPago] = useState("");
  const cortesia = medio === "cortesia";
  const [motivoCortesia, setMotivoCortesia] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [pagoExacto, setPagoExacto] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const cobrandoRef = useRef(false);
  const intentoVenta = useRef<{ firma: string; clave: string } | null>(null);
  const [descuentoTicket, setDescuentoTicket] = useState(0);
  const [descuentoEditado, setDescuentoEditado] = useState<{ lineaId?: string } | null>(null);
  const [documento, setDocumento] = useState<DocumentoVenta | null>(null);
  const [confirmarAnulacion, setConfirmarAnulacion] = useState(false);
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [comprobante, setComprobante] = useState<{ venta: Venta; vuelto: number } | null>(null);
  const { negocio } = useNegocio();
  const tipoDocumento = documento ?? negocio.documentoVentaDefecto ?? "interno";
  const permiteSinStock = negocio.venderSinStock;
  const agruparProductos = negocio.agruparProductosCaja ?? true;
  const porcentajeMaximo = negocio.descuentoMaximoCaja ?? 100;
  const { usuario } = useAuth();
  const [mostrarEspera, setMostrarEspera] = useState(false);
  const [movimientoCaja, setMovimientoCaja] = useState<"ingreso" | "retiro" | null>(null);
  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [referenciaEnvio, setReferenciaEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [listaPrecioId, setListaPrecioId] = useState("");
  const [preciosLista, setPreciosLista] = useState<{ id: string; precios: Record<string, number> | null } | null>(null);
  const [reintentoLista, setReintentoLista] = useState(0);
  const listaActiva = listaPrecioId && preciosLista?.id === listaPrecioId ? preciosLista : null;
  const listaCargando = !!listaPrecioId && !listaActiva;
  const listaError = listaActiva !== null && listaActiva.precios === null;
  const overridePrecios = listaActiva?.precios ?? SIN_OVERRIDES;

  const cargarTurno = async () => {
    const cajaId = sessionStorage.getItem(CLAVE_CAJA);
    try {
      setTurno(cajaId ? await turnosApi.actual(cajaId) : null);
    } catch {
      setTurno(null);
    }
  };

  const cargar = async () => {
    try {
      setLoadError(null);
      const [p, c, l] = await Promise.all([productosApi.listar(), clientesApi.listar(), listasPrecioApi.listar(true)]);
      setProductos(p);
      setClientes(c);
      setListas(l);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargarTurno();
    cargar();
  }, []);

  useEffect(() => {
    if (!listaPrecioId) return;
    let vigente = true;
    listasPrecioApi
      .precios(listaPrecioId)
      .then((precios) => {
        if (vigente) setPreciosLista({ id: listaPrecioId, precios: Object.fromEntries(precios.map((p) => [p.productoId, p.precio])) });
      })
      .catch(() => {
        if (vigente) setPreciosLista({ id: listaPrecioId, precios: null });
      });
    return () => { vigente = false; };
  }, [listaPrecioId, reintentoLista]);

  const precioEfectivo = (p: Producto) => overridePrecios[p.id] ?? p.precioVenta;

  const disponibles = useMemo(() => (productos ?? []).filter((p) => p.activo && p.ventaPublico !== false), [productos]);
  const porId = useMemo(() => new Map(disponibles.map((p) => [p.id, p])), [disponibles]);
  const cantidadPorProducto = new Map<string, number>();
  for (const item of carrito) {
    cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad);
  }
  const cart = carrito.map((item) => {
    const producto = porId.get(item.productoId);
    const precio = overridePrecios[item.productoId] ?? producto?.precioVenta ?? item.precioBase;
    const brutoEnCentavos = aCentavos(precio) * item.cantidad;
    const descuentoEnCentavos = Math.min(aCentavos(item.descuento), Math.floor(brutoEnCentavos * porcentajeMaximo / 100));
    const otrasUnidades = (cantidadPorProducto.get(item.productoId) ?? 0) - item.cantidad;
    const unidadesDisponibles = producto?.inventariable === false || permiteSinStock ? MAX_CANTIDAD : producto?.stockCaja ?? 0;
    return {
      ...item,
      codigo: producto?.codigoBarras || "—",
      precio,
      stockMax: Math.max(0, unidadesDisponibles - otrasUnidades),
      gravado: producto?.tipoImpuesto !== "exento",
      brutoEnCentavos,
      descuentoEnCentavos,
      descuento: descuentoEnCentavos / 100,
    };
  });

  const results = useMemo(() => {
    const term = normalizeSearch(q);
    if (!term) return [];
    return disponibles.filter((p) => matchesSearch(term, [p.nombre, p.codigoBarras])).slice(0, 8);
  }, [q, disponibles]);

  // Un lector de código de barras escribe rápido y termina con Enter: si el texto coincide
  // exacto con un código de barras, se agrega directo sin requerir un clic.
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || cobrandoRef.current || listaCargando || listaError) return;
    const term = q.trim();
    if (!term) return;
    const match =
      disponibles.find((p) => p.codigoBarras?.toLowerCase() === term.toLowerCase());
    if (match) {
      addToCart(match);
    } else if (results.length === 1) {
      addToCart(results[0]);
    } else {
      toast.error("Producto no encontrado");
    }
  };

  const addToCart = (p: Producto) => {
    const enCarrito = agruparProductos ? carrito.find((c) => c.productoId === p.id) : undefined;
    const disponible = (p.inventariable === false || permiteSinStock ? MAX_CANTIDAD : p.stockCaja) - (cantidadPorProducto.get(p.id) ?? 0);
    if (disponible <= 0) {
      toast.error("Sin stock disponible");
      return;
    }
    if (enCarrito) {
      setCarrito(carrito.map((c) => c.id === enCarrito.id ? { ...c, cantidad: c.cantidad + 1 } : c));
    } else {
      setCarrito([...carrito, { id: nuevaClaveVenta(), productoId: p.id, nombre: p.nombre, precioBase: p.precioVenta, cantidad: 1, descuento: 0 }]);
    }
    setQ("");
  };

  const changeQty = (id: string, delta: number) => {
    const item = cart.find((c) => c.id === id);
    if (!item) return;
    const cantidad = item.cantidad + delta;
    if (cantidad < 1 || (delta > 0 && cantidad > item.stockMax)) return;
    const descuento = Math.min(item.descuentoEnCentavos, Math.floor(aCentavos(item.precio) * cantidad * porcentajeMaximo / 100)) / 100;
    setCarrito(carrito.map((c) => c.id === id ? { ...c, cantidad, descuento } : c));
  };
  const removeItem = (id: string) => setCarrito(carrito.filter((c) => c.id !== id));

  const brutoEnCentavos = cart.reduce((s, c) => s + c.brutoEnCentavos, 0);
  const descuentoItemsEnCentavos = cart.reduce((s, c) => s + c.descuentoEnCentavos, 0);
  const subtotalEnCentavos = brutoEnCentavos - descuentoItemsEnCentavos;
  const limiteDescuento = Math.floor(brutoEnCentavos * porcentajeMaximo / 100);
  const limiteGlobal = Math.max(0, limiteDescuento - descuentoItemsEnCentavos);
  const descuentoTicketEnCentavos = Math.min(limiteGlobal, descuentoTicket);
  const totalEnCentavos = subtotalEnCentavos - descuentoTicketEnCentavos;
  const descuentoTicketNum = descuentoTicketEnCentavos / 100;
  const total = totalEnCentavos / 100;
  const totalPago = cortesia ? 0 : total;
  const subtotalGravado = cart.reduce((suma, linea) => suma + (linea.gravado ? linea.brutoEnCentavos - linea.descuentoEnCentavos : 0), 0);
  const iva = subtotalEnCentavos > 0 && !cortesia
    ? Math.round(totalEnCentavos * (subtotalGravado / subtotalEnCentavos) * 19 / 119) / 100 : 0;
  const neto = totalPago - iva;
  const lineaDescuento = cart.find((item) => item.id === descuentoEditado?.lineaId);
  const descuentoAcumulado = descuentoItemsEnCentavos + descuentoTicketEnCentavos;
  const sumaPagos = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const saldo = totalEnCentavos - sumaPagos;
  const montoPropuesto = montoPago === "" ? saldo : aCentavos(Number(montoPago));
  const errorPago = totalEnCentavos <= 0 ? "El total debe ser mayor que cero. Usa cortesía si corresponde."
    : saldo < 0 ? "Los pagos superan el total. Quita un pago para corregirlo."
    : saldo > 0 ? `Falta agregar ${money(saldo / 100)} al pago.`
    : null;
  const stockValido = cart.every((c) => c.cantidad <= c.stockMax);

  const montoEfectivoVenta = (pagos.find((p) => p.metodoPago === "efectivo")?.monto ?? 0) / 100;
  const recibido = pagoExacto ? montoInput(montoEfectivoVenta) : montoRecibido;
  const diferenciaEfectivo = aCentavos(Number(recibido)) - aCentavos(montoEfectivoVenta);
  const efectivoInsuficiente = !cortesia && montoEfectivoVenta > 0 && recibido !== "" && diferenciaEfectivo < 0;

  const agregarPago = () => {
    if (medio === "cortesia" || !Number.isFinite(montoPropuesto) || montoPropuesto <= 0 || montoPropuesto > saldo) return;
    const montoAnterior = pagos.find((p) => p.metodoPago === medio)?.monto ?? 0;
    setPagos([...pagos.filter((p) => p.metodoPago !== medio), { metodoPago: medio, monto: montoAnterior + montoPropuesto }]);
    setMontoPago("");
  };

  // "Venta nueva": resetea todo el ticket (carrito, cliente, formas de pago, descuento).
  const resetCompleto = () => {
    setCarrito([]);
    intentoVenta.current = null;
    setClienteId("");
    setPagos([]);
    setMedio("efectivo");
    setMontoPago("");
    setDescuentoTicket(0);
    setDocumento(null);
    setMotivoCortesia("");
    setMontoRecibido("");
    setPagoExacto(false);
    setQ("");
  };

  const enviarAEspera = async () => {
    if (cart.length === 0) return;
    setEnviando(true);
    try {
      await ventasEnEsperaApi.crear({
        referencia: referenciaEnvio.trim() || null,
        clienteId: clienteId || null,
        descuento: descuentoTicketNum,
        tipoDocumento,
        items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad, descuento: c.descuento })),
      });
      resetCompleto();
      setMostrarEnviar(false);
      setReferenciaEnvio("");
      toast.success("Venta enviada a espera");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo enviar la venta");
    } finally {
      setEnviando(false);
    }
  };

  const recuperarEnEspera = async (v: VentaEnEspera) => {
    if (carrito.length) {
      toast.info("Guarda o limpia el ticket actual antes de recuperar otra venta.");
      return;
    }
    const recuperado: CartItem[] = [];
    const recuperadas = new Map<string, number>();
    for (const it of v.items) {
      const anteriores = recuperadas.get(it.productoId) ?? 0;
      const cantidad = it.producto.inventariable === false || permiteSinStock ? it.cantidad : Math.min(it.cantidad, it.producto.stockCaja - anteriores);
      if (!it.producto.activo || it.producto.ventaPublico === false || cantidad <= 0) continue;
      const previo = agruparProductos ? recuperado.find((item) => item.productoId === it.productoId) : undefined;
      if (previo) {
        previo.cantidad += cantidad;
        previo.descuento += it.descuento;
      } else {
        recuperado.push({ id: it.id, productoId: it.productoId, nombre: it.producto.nombre, precioBase: it.producto.precioVenta, cantidad, descuento: it.descuento });
      }
      recuperadas.set(it.productoId, anteriores + cantidad);
    }
    if (!recuperado.length) {
      toast.error("La venta sigue en espera. Sus productos no tienen stock disponible en caja.");
      return;
    }
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      resetCompleto();
      setCarrito(recuperado);
      setClienteId(v.clienteId || "");
      setDescuentoTicket(aCentavos(v.descuento));
      setDocumento(v.tipoDocumento ?? null);
      setMostrarEspera(false);
      if (recuperado.reduce((suma, it) => suma + it.cantidad, 0) !== v.items.reduce((suma, it) => suma + it.cantidad, 0)) {
        toast.warning("El ticket se ajustó al stock disponible en caja.");
      }
      toast.success("Venta recuperada");
      await cargar();
    } catch {
      toast.error("No se pudo recuperar la venta en espera. Actualiza la lista e inténtalo de nuevo.");
    }
  };

  const cobrar = async () => {
    if (!turno || cobrandoRef.current || cart.length === 0 || listaCargando || listaError || !stockValido || efectivoInsuficiente) return;
    if (cortesia) {
      if (!motivoCortesia.trim()) {
        toast.error("Indica el motivo de la cortesía");
        return;
      }
    } else if (errorPago) {
      return;
    }
    const data: VentaInput = {
      turnoCajaId: turno.id,
      clienteId: clienteId || null,
      listaPrecioId: listaPrecioId || null,
      tipoDocumento,
      esCortesia: cortesia,
      motivoCortesia: cortesia ? motivoCortesia.trim() : undefined,
      pagos: cortesia ? undefined : pagos.map((p) => ({ metodoPago: p.metodoPago, monto: p.monto / 100 })),
      descuento: descuentoTicketNum,
      items: cart.map((c) => ({ productoId: c.productoId, cantidad: c.cantidad, descuento: c.descuento })),
    };
    const firma = JSON.stringify(data);
    if (intentoVenta.current?.firma !== firma) intentoVenta.current = { firma, clave: nuevaClaveVenta() };
    cobrandoRef.current = true;
    setCobrando(true);
    try {
      const venta = await ventasApi.crear({ ...data, claveIdempotencia: intentoVenta.current.clave });
      const cambio = !cortesia && montoEfectivoVenta > 0 ? diferenciaEfectivo : 0;
      resetCompleto();
      toast.success(cortesia ? "Cortesía registrada" : "Venta registrada");
      setComprobante({ venta, vuelto: Math.max(0, cambio) / 100 });
      await cargar();
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) {
        toast.error(e.message);
        await cargar();
        await cargarTurno();
      } else {
        toast.error("No se recibió confirmación. Reintenta el cobro con el mismo ticket.");
      }
    } finally {
      cobrandoRef.current = false;
      setCobrando(false);
    }
  };

  if (loadError && !comprobante) {
    return (
      <CajaLayout>
        <div className="font-body text-sm text-center py-10 text-destructive">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      </CajaLayout>
    );
  }

  if (productos === null || turno === undefined) {
    return (
      <CajaLayout>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CajaLayout>
    );
  }

  if (turno === null) {
    return <AbrirTurnoCard onAbierto={(actual) => {
      sessionStorage.setItem(CLAVE_CAJA, actual.cajaId);
      setTurno(actual);
    }} />;
  }

  return (
    <CajaLayout operativa>
      <section aria-label="Turno activo" className="company-banner mb-3 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 text-hero-foreground">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold [overflow-wrap:anywhere]">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15" aria-hidden="true"><Receipt size={17} /></span>
          {turno.caja.nombre} · {turno.tipoTurno.nombre}
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-hero/90 px-2.5 py-1.5 text-xs text-hero-muted">
          <Clock size={14} className="shrink-0" aria-hidden="true" />
          <span>Abierto el <time dateTime={turno.fechaApertura}>{new Date(turno.fechaApertura).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}</time></span>
          {turno.usuarioApertura && <span className="[overflow-wrap:anywhere]">· {turno.usuarioApertura.nombre}</span>}
        </p>
      </section>

      <div role="group" aria-label="Vista de caja" className="mb-2 grid shrink-0 grid-cols-2 gap-2 xl:hidden">
        <Button type="button" size="sm" variant={vistaCompacta === "productos" ? "default" : "outline"}
          aria-pressed={vistaCompacta === "productos"} onClick={() => setVistaCompacta("productos")}>Productos</Button>
        <Button type="button" size="sm" variant={vistaCompacta === "pago" ? "default" : "outline"}
          aria-pressed={vistaCompacta === "pago"} onClick={() => setVistaCompacta("pago")}>Pago y opciones</Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,27%)]">
        <div className={cn("min-h-0 min-w-0 flex-col gap-2 xl:flex", vistaCompacta === "productos" ? "flex" : "hidden")}>
          <div className="grid min-w-0 shrink-0 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)]">
            <CajaBusqueda productos={disponibles} resultados={results} texto={q} alBuscar={setQ}
              alTecla={handleSearchKeyDown} agregar={addToCart} precio={precioEfectivo} permiteSinStock={permiteSinStock} bloqueado={cobrando || listaCargando || listaError} />
            <Select value={listaPrecioId || LISTA_BASE} disabled={cobrando}
              onValueChange={(v) => { setPreciosLista(null); setListaPrecioId(v === LISTA_BASE ? "" : v); }}>
              <SelectTrigger aria-label="Lista de precios" className="w-full bg-card data-[size=default]:h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={LISTA_BASE}>Lista de precios base</SelectItem>
                {listas.map((lista) => <SelectItem key={lista.id} value={lista.id}>{lista.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {listaCargando && <p role="status" className="text-sm text-muted-foreground">Cargando precios de la lista…</p>}
          {listaError && (
            <p role="alert" className="text-sm text-destructive">
              No se pudieron cargar los precios. <button type="button" className="underline" onClick={() => setReintentoLista((n) => n + 1)}>Reintentar</button>
            </p>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            <CajaGrilla filas={cart} bloqueada={cobrando || listaCargando || listaError}
              cambiarCantidad={changeQty} descuentosActivos={porcentajeMaximo > 0} editarDescuento={(lineaId) => setDescuentoEditado({ lineaId })} quitar={removeItem} />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-secondary/50 px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Receipt size={18} /></span>
                <div>
                  <Label htmlFor="caja-documento" className="mb-1 text-xs text-muted-foreground">Documento de venta</Label>
                  <Select value={tipoDocumento} disabled={cobrando} onValueChange={(valor) => setDocumento(valor as DocumentoVenta)}>
                    <SelectTrigger id="caja-documento" size="sm" className="w-full bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(DOCUMENTOS_VENTA).map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">{cortesia ? "Total a cobrar" : "Total de la venta"}</p>
                  <p className="font-display text-2xl font-bold leading-tight tabular-nums">{money(totalPago)}</p>
                  {descuentoTicketEnCentavos > 0 && <p className="text-xs text-muted-foreground">Descuento global {money(descuentoTicketNum)}</p>}
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Editar descuento global" title="Editar descuento global"
                  disabled={cobrando || !cart.length || listaCargando || listaError || (porcentajeMaximo === 0 && !descuentoTicket)}
                  onClick={() => setDescuentoEditado({})}><Pencil size={16} /></Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="pago" className={cn("min-h-0 min-w-0 gap-2 xl:flex", vistaCompacta === "pago" ? "flex" : "hidden")}>
          <TabsList aria-label="Acciones de caja" className="h-11 w-full shrink-0">
            <TabsTrigger value="pago"><CreditCard size={16} /> Pago</TabsTrigger>
            <TabsTrigger value="opciones"><Settings2 size={16} /> Opciones</TabsTrigger>
          </TabsList>

          <TabsContent value="pago" className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm data-[state=active]:flex data-[state=active]:flex-col">
            <fieldset disabled={cobrando} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <legend className="sr-only">Pago de la venta</legend>
              <CajaCliente clientes={clientes} clienteId={clienteId} seleccionar={setClienteId} puedeCrear={tieneAcceso(usuario, { seccion: "clientes" })}
                creado={(cliente) => { setClientes((actual) => [...actual, cliente]); setClienteId(cliente.id); }} />

              <dl className="space-y-2 rounded-xl bg-hero p-4 text-sm text-hero-foreground">
                {descuentoAcumulado > 0 && (
                  <>
                    <div className="flex justify-between gap-2 text-hero-muted"><dt>Antes del descuento</dt><dd>{money(brutoEnCentavos / 100)}</dd></div>
                    <div className="flex justify-between gap-2 text-hero-muted"><dt>Descuento</dt><dd>−{money(descuentoAcumulado / 100)}</dd></div>
                  </>
                )}
                <div className="flex justify-between gap-2 text-hero-muted"><dt>Neto</dt><dd className="tabular-nums">{money(neto)}</dd></div>
                <div className="flex justify-between gap-2 text-hero-muted"><dt>IVA</dt><dd className="tabular-nums">{money(iva)}</dd></div>
                <div className="flex items-baseline justify-between gap-2 border-t border-white/20 pt-2 font-semibold">
                  <dt>{descuentoAcumulado > 0 && !cortesia ? "Total con descuento" : "Total"}</dt>
                  <dd className="font-display text-3xl font-bold tabular-nums">{money(totalPago)}</dd>
                </div>
                {cortesia && <div className="flex justify-between gap-2 text-xs text-hero-muted"><dt>Valor de referencia</dt><dd>{money(total)}</dd></div>}
              </dl>

              <div className="space-y-2">
                <p id="caja-formas-pago" className="text-sm font-semibold">Forma de pago</p>
                <div role="group" aria-labelledby="caja-formas-pago" className="grid grid-cols-2 gap-2 min-[500px]:grid-cols-3">
                  {METODOS.map((metodo) => (
                    <Button key={metodo} type="button" size="sm" className="justify-start px-2.5"
                      variant={medio === metodo ? "default" : "outline"} aria-pressed={medio === metodo} onClick={() => setMedio(metodo)}>
                      {metodo === "cortesia" ? <Gift size={15} /> : metodo === "efectivo" ? <Banknote size={15} /> : <CreditCard size={15} />}
                      {metodo === "cortesia" ? "Cortesía" : ETIQUETAS_PAGO[metodo]}
                    </Button>
                  ))}
                </div>
              </div>
              {cortesia && <Input aria-label="Motivo de la cortesía" value={motivoCortesia}
                onChange={(e) => setMotivoCortesia(e.target.value)} placeholder="Motivo de la cortesía (obligatorio)" />}

              {!cortesia && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="caja-monto-pago">Monto en {ETIQUETAS_PAGO[medio].toLowerCase()}</Label>
                    <Input id="caja-monto-pago" type="number" min={0} step="0.01" inputMode="decimal" value={montoPago}
                      placeholder={montoInput(Math.max(0, saldo) / 100)} disabled={saldo <= 0}
                      onChange={(e) => setMontoPago(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregarPago(); }}
                      className="text-right tabular-nums" />
                    <Button type="button" variant="outline" className="w-full border-primary/35 bg-secondary text-secondary-foreground"
                      disabled={!Number.isFinite(montoPropuesto) || montoPropuesto <= 0 || montoPropuesto > saldo} onClick={agregarPago}><Plus size={16} /> Agregar al pago</Button>
                  </div>
                  {!!pagos.length && (
                    <ul aria-label="Pagos agregados" className="divide-y rounded-lg border bg-muted/40 px-3">
                      {pagos.map((pago) => (
                        <li key={pago.metodoPago} className="flex items-center gap-2 py-1 text-sm">
                          <span className="flex-1">{ETIQUETAS_PAGO[pago.metodoPago]}</span>
                          <strong className="tabular-nums">{money(pago.monto / 100)}</strong>
                          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Quitar pago en ${ETIQUETAS_PAGO[pago.metodoPago]}`}
                            onClick={() => { setPagos(pagos.filter((item) => item.metodoPago !== pago.metodoPago)); setMontoPago(""); }}><X size={15} /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {montoEfectivoVenta > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor="caja-recibido">Efectivo recibido</Label>
                      <div className="flex gap-2">
                        <Input id="caja-recibido" type="number" min={0} step="0.01" value={recibido} inputMode="decimal"
                          onChange={(e) => { setPagoExacto(false); setMontoRecibido(e.target.value); }}
                          placeholder={montoInput(montoEfectivoVenta)} className="min-w-0 text-right tabular-nums" />
                        <Button type="button" variant={pagoExacto ? "default" : "outline"} aria-pressed={pagoExacto} onClick={() => {
                          setMontoRecibido(montoInput(montoEfectivoVenta));
                          setPagoExacto(true);
                        }} className="shrink-0 px-2.5">Pago exacto</Button>
                      </div>
                      {recibido && diferenciaEfectivo >= 0 && <p className="text-right text-sm font-semibold text-primary">Vuelto {money(diferenciaEfectivo / 100)}</p>}
                    </div>
                  )}
                  {cart.length > 0 && errorPago && <p role="status" className={cn("text-xs", saldo < 0 ? "text-destructive" : "text-muted-foreground")}>{errorPago}</p>}
                  {efectivoInsuficiente && <p role="status" className="text-xs text-destructive">El efectivo recibido es menor que el monto a cobrar en efectivo.</p>}
                </div>
              )}

            </fieldset>
            <div className="shrink-0 border-t bg-card px-4 py-3 sm:px-5">
              <Button type="button" onClick={cobrar} size="lg" className="w-full"
                disabled={cart.length === 0 || cobrando || listaCargando || listaError || !stockValido || efectivoInsuficiente || (cortesia ? !motivoCortesia.trim() : !!errorPago)}>
                {cobrando ? "Procesando…" : cortesia ? "Registrar cortesía" : `Cobrar ${money(total)}`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="opciones" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground">Venta</h2>
              <Button type="button" variant="outline" disabled={cobrando || !cart.length || listaCargando || listaError} className="justify-start"
                onClick={() => setMostrarEnviar(true)}><Send size={15} /> Enviar a espera</Button>
              <Button type="button" variant="outline" disabled={cobrando} className="justify-start"
                onClick={() => setMostrarEspera(true)}><Inbox size={15} /> Ver ventas en espera</Button>
              <Button type="button" variant="outline" disabled={cobrando || !cart.length} className="justify-start text-destructive"
                onClick={() => setConfirmarAnulacion(true)}><X size={15} /> Anular venta en curso</Button>
              {!cart.length && tieneAcceso(usuario, { seccion: "historial" }) && (
                <Button asChild variant="ghost" className="justify-start"><Link to="/historial"><Receipt size={15} /> Devoluciones y notas de crédito</Link></Button>
              )}
            </div>
            <div className="grid gap-2 border-t pt-4">
              <h2 className="text-xs font-semibold text-muted-foreground">Caja</h2>
              <Button type="button" variant="outline" disabled={cobrando} className="justify-start"
                onClick={() => setMovimientoCaja("ingreso")}><Banknote size={15} /> Ingreso de efectivo</Button>
              <Button type="button" variant="outline" disabled={cobrando} className="justify-start"
                onClick={() => setMovimientoCaja("retiro")}><Banknote size={15} /> Retiro de efectivo</Button>
              <Button type="button" variant="outline" disabled={cobrando || !!cart.length} className="justify-start"
                onClick={() => setMostrarCierre(true)}><LogOut size={15} /> Cerrar caja</Button>
              <Button type="button" variant="ghost" disabled={cobrando || !!cart.length} className="justify-start" onClick={() => {
                sessionStorage.removeItem(CLAVE_CAJA);
                resetCompleto();
                setTurno(null);
              }}>Cambiar caja</Button>
              {!!cart.length && <p className="text-xs text-muted-foreground">Termina la venta o déjala en espera para cerrar o cambiar de caja.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {descuentoEditado && (
        <CajaDescuentoDialog
          titulo={lineaDescuento ? `Descuento de ${lineaDescuento.nombre}` : "Descuento global"}
          base={lineaDescuento?.brutoEnCentavos ?? subtotalEnCentavos}
          actual={lineaDescuento?.descuentoEnCentavos ?? descuentoTicketEnCentavos}
          maximo={lineaDescuento ? Math.max(0, Math.min(
            Math.floor(lineaDescuento.brutoEnCentavos * porcentajeMaximo / 100),
            limiteDescuento - descuentoAcumulado + lineaDescuento.descuentoEnCentavos,
          )) : limiteGlobal}
          cerrar={() => setDescuentoEditado(null)}
          aplicar={(centavos) => {
            if (lineaDescuento) {
              setCarrito(carrito.map((item) => item.id === lineaDescuento.id ? { ...item, descuento: centavos / 100 } : item));
            } else {
              setDescuentoTicket(centavos);
            }
            setDescuentoEditado(null);
          }}
        />
      )}

      <Dialog open={confirmarAnulacion} onOpenChange={setConfirmarAnulacion}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Anular venta en curso?</DialogTitle>
            <DialogDescription>Se descartarán los productos, descuentos y pagos del carrito actual.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarAnulacion(false)}>Volver</Button>
            <Button type="button" variant="destructive" onClick={() => { resetCompleto(); setConfirmarAnulacion(false); }}>Anular venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mostrarCierre && (
        <CerrarTurnoDialog
          turno={turno}
          onClose={() => setMostrarCierre(false)}
          onCerrado={() => {
            setMostrarCierre(false);
            sessionStorage.removeItem(CLAVE_CAJA);
            setTurno(null);
          }}
        />
      )}

      <Dialog open={!!comprobante} onOpenChange={(o) => !o && setComprobante(null)}>
        <DialogContent className="sm:max-w-md">
          {comprobante && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <DialogTitle>{comprobante.venta.esCortesia ? "Cortesía registrada" : "Venta registrada"}</DialogTitle>
                    <DialogDescription>Comprobante interno {folioComprobante(comprobante.venta.id)}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <dl className="space-y-2 rounded-lg border bg-muted/35 p-4 text-sm">
                <div className="flex items-center justify-between gap-3 font-semibold">
                  <dt>Total cobrado</dt>
                  <dd className="tabular-nums">{money(comprobante.venta.esCortesia ? 0 : comprobante.venta.total)}</dd>
                </div>
                {comprobante.venta.esCortesia && (
                  <div className="flex items-center justify-between gap-3 text-muted-foreground">
                    <dt>Valor de referencia</dt>
                    <dd className="tabular-nums">{money(comprobante.venta.total)}</dd>
                  </div>
                )}
                {comprobante.venta.pagos.map(({ metodoPago, monto }) => (
                  <div key={metodoPago} className="flex items-center justify-between gap-3 text-muted-foreground">
                    <dt className="capitalize">{metodoPago}</dt>
                    <dd className="tabular-nums">{money(monto)}</dd>
                  </div>
                ))}
                {comprobante.vuelto > 0 && (
                  <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold text-primary">
                    <dt>Vuelto</dt>
                    <dd className="text-xl tabular-nums">{money(comprobante.vuelto)}</dd>
                  </div>
                )}
              </dl>
              <DialogFooter>
                <Button variant="outline" onClick={() => setComprobante(null)}>
                  Nueva venta
                </Button>
                <Button onClick={() => {
                  if (!printTicket(comprobante.venta, negocio)) toast.warning("Permite las ventanas emergentes para imprimir el comprobante.");
                }}>
                  <Printer size={15} /> Imprimir comprobante
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <VentasEnEsperaDialog open={mostrarEspera} onClose={() => setMostrarEspera(false)} onRecuperar={recuperarEnEspera} />

      {movimientoCaja && (
        <MovimientoCajaDialog key={`${turno.id}:${movimientoCaja}`} turnoCajaId={turno.id}
          tipoInicial={movimientoCaja} onClose={() => setMovimientoCaja(null)} />
      )}

      <Dialog open={mostrarEnviar} onOpenChange={(o) => !o && setMostrarEnviar(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar a espera</DialogTitle>
            <DialogDescription>Guarda este carrito para retomarlo después.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Referencia (opcional)</Label>
            <Input
              autoFocus
              value={referenciaEnvio}
              onChange={(e) => setReferenciaEnvio(e.target.value)}
              placeholder="Ej. Mesa 3, nombre del cliente..."
              onKeyDown={(e) => e.key === "Enter" && enviarAEspera()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarEnviar(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarAEspera} disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CajaLayout>
  );
}
