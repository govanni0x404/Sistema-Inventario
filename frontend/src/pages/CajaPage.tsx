import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PropsWithChildren } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, ChevronDown, CircleAlert, ClipboardList, Clock, CreditCard, Gift, Inbox, Landmark, LogOut, Pencil, Plus, Printer, Receipt, RefreshCw, Send, Settings2, ShoppingBag, WalletCards, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { cotizacionesApi, type Cotizacion } from "@/api/cotizaciones";
import CotizarDialog from "@/components/CotizarDialog";
import { idOperacion as nuevaClaveVenta } from "@/lib/idOperacion";
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
import { DOCUMENTOS_VENTA, nombreDocumento, type DocumentoVenta } from "../types/negocio";
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
import { aCentavos, aPesosEnteros, LOCALE, moneyCaja as money, montoInput, pesosACentavos, pisoPesosEnteros } from "../lib/format";
import ConfirmDialog from "../components/ConfirmDialog";
import { matchesSearch, normalizeSearch } from "../lib/search";


type CartItem = { id: string; productoId: string; nombre: string; precioBase: number; cantidad: number; descuento: number;
  cotizado?: { precio: number; gravado: boolean; codigo: string | null } };

const METODOS = ["efectivo", "debito", "credito", "transferencia", "cortesia"] as const;
type MedioCaja = (typeof METODOS)[number];
const LISTA_BASE = "__base__";
const SIN_OVERRIDES: Record<string, number> = {};
const CLAVE_CAJA = "inventario_caja_actual";
const MAX_CANTIDAD = 2_147_483_647;

// Cada forma de pago tiene su color (tokens del tema) para reconocerla de un vistazo.
// Las clases van completas para que Tailwind las detecte.
const ESTILO_METODO: Record<MedioCaja, { icono: LucideIcon; chip: string; activo: string; hover: string }> = {
  efectivo: { icono: Banknote, chip: "bg-success/15 text-success", activo: "border-success bg-success/10 ring-success/35", hover: "hover:border-success/50 hover:bg-success/5" },
  debito: { icono: CreditCard, chip: "bg-info/15 text-info", activo: "border-info bg-info/10 ring-info/35", hover: "hover:border-info/50 hover:bg-info/5" },
  credito: { icono: WalletCards, chip: "bg-brand-2/15 text-brand-2", activo: "border-brand-2 bg-brand-2/10 ring-brand-2/35", hover: "hover:border-brand-2/50 hover:bg-brand-2/5" },
  transferencia: { icono: Landmark, chip: "bg-primary/15 text-primary", activo: "border-primary bg-primary/10 ring-primary/35", hover: "hover:border-primary/50 hover:bg-primary/5" },
  cortesia: { icono: Gift, chip: "bg-warning/15 text-warning", activo: "border-warning bg-warning/10 ring-warning/35", hover: "hover:border-warning/50 hover:bg-warning/5" },
};
const etiquetaMetodo = (metodo: MedioCaja) => metodo === "cortesia" ? "Cortesía" : ETIQUETAS_PAGO[metodo];

function CajaLayout({ children, operativa = false, titulo = "Caja" }: PropsWithChildren<{ operativa?: boolean; titulo?: string }>) {
  return (
    <div className={operativa
      ? "caja-vista-fija flex min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3"
      : "w-full p-2 sm:p-3"}>
      <h1 className={operativa ? "sr-only" : "mb-5 shrink-0 font-display text-3xl leading-tight font-bold tracking-[-0.04em] sm:text-4xl"}>{titulo}</h1>
      {children}
    </div>
  );
}

export default function CajaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cotizacionSolicitada = params.get("cotizacion");
  const modoCotizar = params.get("modo") === "cotizar" && !cotizacionSolicitada;
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [mostrarCotizar, setMostrarCotizar] = useState(false);
  const [pestanaCaja, setPestanaCaja] = useState("pago");
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
  const [turnoError, setTurnoError] = useState<string | null>(null);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [comprobante, setComprobante] = useState<{ venta: Venta; vuelto: number } | null>(null);
  const { negocio } = useNegocio();
  const tipoDocumento = documento ?? negocio.documentoVentaDefecto ?? "interno";
  const permiteSinStock = modoCotizar || negocio.venderSinStock;
  const agruparProductos = negocio.agruparProductosCaja ?? true;
  const porcentajeMaximo = negocio.descuentoMaximoCaja ?? 100;
  const { usuario } = useAuth();
  const [mostrarEspera, setMostrarEspera] = useState(false);
  const [movimientoCaja, setMovimientoCaja] = useState<"ingreso" | "retiro" | null>(null);
  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [referenciaEnvio, setReferenciaEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [recuperacionPendiente, setRecuperacionPendiente] = useState<{ venta: VentaEnEspera; items: CartItem[]; ajustes: string[] } | null>(null);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [listaPrecioId, setListaPrecioId] = useState("");
  const [preciosLista, setPreciosLista] = useState<{ id: string; precios: Record<string, number> | null } | null>(null);
  const [reintentoLista, setReintentoLista] = useState(0);
  const listaActiva = listaPrecioId && preciosLista?.id === listaPrecioId ? preciosLista : null;
  const listaCargando = !!listaPrecioId && !listaActiva;
  const listaError = listaActiva !== null && listaActiva.precios === null;
  const overridePrecios = listaActiva?.precios ?? SIN_OVERRIDES;

  // Un error de red no significa "sin turno": se muestra el error y se permite reintentar,
  // para no invitar a abrir otro turno sobre una caja que ya está abierta.
  const cargarTurno = async () => {
    const cajaId = sessionStorage.getItem(CLAVE_CAJA);
    setTurnoError(null);
    try {
      setTurno(cajaId ? await turnosApi.actual(cajaId) : null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        sessionStorage.removeItem(CLAVE_CAJA);
        setTurno(null);
        return;
      }
      setTurnoError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
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

  const precioEfectivo = useCallback((p: Producto) => overridePrecios[p.id] ?? p.precioVenta, [overridePrecios]);

  const disponibles = useMemo(() => (productos ?? []).filter((p) => p.activo && p.ventaPublico !== false), [productos]);
  const porId = useMemo(() => new Map(disponibles.map((p) => [p.id, p])), [disponibles]);
  const cantidadPorProducto = useMemo(() => {
    const cantidades = new Map<string, number>();
    for (const item of carrito) cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);
    return cantidades;
  }, [carrito]);
  // CLP sin centavos: precios y descuentos de cada línea quedan en pesos enteros (múltiplos de 100 centavos).
  const cart = useMemo(() => carrito.map((item) => {
    const producto = porId.get(item.productoId);
    const precio = overridePrecios[item.productoId] ?? producto?.precioVenta ?? item.precioBase;
    const precioEnCentavos = item.cotizado?.precio ?? aPesosEnteros(aCentavos(precio));
    const brutoEnCentavos = precioEnCentavos * item.cantidad;
    const descuentoEnCentavos = item.cotizado ? aCentavos(item.descuento) :
      Math.min(aPesosEnteros(aCentavos(item.descuento)), pisoPesosEnteros(Math.floor(brutoEnCentavos * porcentajeMaximo / 100)));
    const otrasUnidades = (cantidadPorProducto.get(item.productoId) ?? 0) - item.cantidad;
    const unidadesDisponibles = producto?.inventariable === false || permiteSinStock ? MAX_CANTIDAD : producto?.stockCaja ?? 0;
    return {
      ...item,
      codigo: item.cotizado?.codigo || producto?.codigoBarras || "—",
      precio: precioEnCentavos / 100,
      stockMax: Math.max(0, unidadesDisponibles - otrasUnidades),
      gravado: item.cotizado?.gravado ?? producto?.tipoImpuesto !== "exento",
      brutoEnCentavos,
      descuentoEnCentavos,
      descuento: descuentoEnCentavos / 100,
    };
  }), [carrito, porId, overridePrecios, porcentajeMaximo, cantidadPorProducto, permiteSinStock]);

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

  const addToCart = useCallback((p: Producto) => {
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
  }, [agruparProductos, carrito, permiteSinStock, cantidadPorProducto]);

  const changeQty = useCallback((id: string, delta: number) => {
    const item = cart.find((c) => c.id === id);
    if (!item) return;
    const cantidad = item.cantidad + delta;
    if (cantidad < 1 || (delta > 0 && cantidad > item.stockMax)) return;
    const descuento = Math.min(item.descuentoEnCentavos, pisoPesosEnteros(Math.floor(aCentavos(item.precio) * cantidad * porcentajeMaximo / 100))) / 100;
    setCarrito((actual) => actual.map((c) => c.id === id ? { ...c, cantidad, descuento } : c));
  }, [cart, porcentajeMaximo]);
  const removeItem = useCallback((id: string) => setCarrito((actual) => actual.filter((c) => c.id !== id)), []);
  const editarDescuentoLinea = useCallback((lineaId: string) => setDescuentoEditado({ lineaId }), []);

  const totales = useMemo(() => {
    const brutoEnCentavos = cart.reduce((s, c) => s + c.brutoEnCentavos, 0);
    const descuentoItemsEnCentavos = cart.reduce((s, c) => s + c.descuentoEnCentavos, 0);
    const subtotalEnCentavos = brutoEnCentavos - descuentoItemsEnCentavos;
    const limiteDescuento = pisoPesosEnteros(Math.floor(brutoEnCentavos * porcentajeMaximo / 100));
    const limiteGlobal = Math.max(0, limiteDescuento - descuentoItemsEnCentavos);
    const descuentoTicketEnCentavos = cotizacion ? descuentoTicket : Math.min(limiteGlobal, aPesosEnteros(descuentoTicket));
    const totalEnCentavos = subtotalEnCentavos - descuentoTicketEnCentavos;
    const subtotalGravado = cart.reduce((suma, linea) => suma + (linea.gravado ? linea.brutoEnCentavos - linea.descuentoEnCentavos : 0), 0);
    // IVA incluido (19 %) sobre la parte gravada, redondeado a pesos enteros; el neto es la diferencia.
    const ivaEnCentavos = subtotalEnCentavos > 0 && !cortesia
      ? aPesosEnteros(Math.round(totalEnCentavos * (subtotalGravado / subtotalEnCentavos) * 19 / 119)) : 0;
    return { brutoEnCentavos, descuentoItemsEnCentavos, subtotalEnCentavos, limiteDescuento, limiteGlobal, descuentoTicketEnCentavos, totalEnCentavos, ivaEnCentavos };
  }, [cart, porcentajeMaximo, descuentoTicket, cortesia, cotizacion]);
  const { brutoEnCentavos, descuentoItemsEnCentavos, subtotalEnCentavos, limiteDescuento, limiteGlobal, descuentoTicketEnCentavos, totalEnCentavos } = totales;
  const descuentoTicketNum = descuentoTicketEnCentavos / 100;
  const total = totalEnCentavos / 100;
  const totalPago = cortesia ? 0 : total;
  const iva = totales.ivaEnCentavos / 100;
  const neto = totalPago - iva;
  const cantidadTotal = cart.reduce((suma, linea) => suma + linea.cantidad, 0);
  const lineaDescuento = cart.find((item) => item.id === descuentoEditado?.lineaId);
  const descuentoAcumulado = descuentoItemsEnCentavos + descuentoTicketEnCentavos;
  const sumaPagos = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const saldo = totalEnCentavos - sumaPagos;
  const montoPagoDecimal = montoPago !== "" && !Number.isInteger(Number(montoPago));
  const montoPropuesto = montoPago === "" ? saldo : montoPagoDecimal ? Number.NaN : pesosACentavos(Number(montoPago));
  const errorPago = totalEnCentavos <= 0 ? "El total debe ser mayor que cero. Usa cortesía si corresponde."
    : saldo < 0 ? "Los pagos superan el total. Quita un pago para corregirlo."
    : saldo > 0 ? `Falta agregar ${money(saldo / 100)} al pago.`
    : null;
  const stockValido = cart.every((c) => c.cantidad <= c.stockMax && (!cotizacion || porId.has(c.productoId)));

  const montoEfectivoVenta = (pagos.find((p) => p.metodoPago === "efectivo")?.monto ?? 0) / 100;
  const recibido = pagoExacto ? montoInput(montoEfectivoVenta) : montoRecibido;
  const diferenciaEfectivo = pesosACentavos(Number(recibido)) - aCentavos(montoEfectivoVenta);
  const efectivoInsuficiente = !cortesia && montoEfectivoVenta > 0 && recibido !== "" && diferenciaEfectivo < 0;

  const elegirMedio = (metodo: MedioCaja) => {
    if (cotizacion && metodo === "cortesia") return;
    setMedio(metodo);
    setMontoPago("");
    // En cortesía no se cobra: se limpian los pagos agregados para no mostrar ni enviar montos obsoletos.
    if (metodo === "cortesia") {
      setPagos([]);
      setMontoRecibido("");
      setPagoExacto(false);
    }
  };

  const agregarPago = () => {
    if (medio === "cortesia" || !Number.isFinite(montoPropuesto) || montoPropuesto <= 0 || montoPropuesto > saldo) return;
    const montoAnterior = pagos.find((p) => p.metodoPago === medio)?.monto ?? 0;
    setPagos([...pagos.filter((p) => p.metodoPago !== medio), { metodoPago: medio, monto: montoAnterior + montoPropuesto }]);
    setMontoPago("");
  };

  // "Venta nueva": resetea todo el ticket (carrito, cliente, formas de pago, descuento).
  const resetCompleto = useCallback(() => {
    setCarrito([]);
    setCotizacion(null);
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
  }, []);

  const turnoActivo = Boolean(turno);
  useEffect(() => {
    if (!cotizacionSolicitada || !turnoActivo) return;
    let vigente = true;
    cotizacionesApi.obtener(cotizacionSolicitada).then((actual) => {
      if (!vigente) return;
      if (actual.estado !== "vigente") throw new Error("La cotización ya no está disponible para cobrar");
      resetCompleto();
      setCotizacion(actual);
      setClienteId(actual.clienteId);
      setListaPrecioId("");
      setDescuentoTicket(aCentavos(actual.descuento));
      setCarrito(actual.items.map((it) => ({
        id: nuevaClaveVenta(), productoId: it.productoId, nombre: it.nombre, precioBase: it.precio / 100,
        cantidad: it.cantidad, descuento: it.descuento / 100,
        cotizado: { precio: it.precio, gravado: it.gravado, codigo: it.codigo },
      })));
      setPestanaCaja("pago");
      setVistaCompacta("pago");
      navigate("/caja", { replace: true });
    }).catch((e) => {
      if (!vigente) return;
      toast.error(e instanceof Error ? e.message : "No se pudo cargar la cotización");
      navigate("/caja", { replace: true });
    });
    return () => { vigente = false; };
  }, [cotizacionSolicitada, turnoActivo, navigate, resetCompleto]);

  const bloqueada = cobrando || Boolean(cotizacionSolicitada);
  const puedeCotizar = !bloqueada && !cotizacion && Boolean(clienteId) && cart.length > 0 &&
    totalEnCentavos > 0 && !listaCargando && !listaError;

  const buscarProductos = useCallback(() => {
    setVistaCompacta("productos");
    requestAnimationFrame(() => document.getElementById("caja-buscador")?.focus());
  }, []);

  useEffect(() => {
    if ((!turnoActivo && !modoCotizar) || bloqueada) return;
    const atajo = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ||
        document.querySelector('[role="dialog"][data-state="open"]') || (e.target as Element | null)?.closest?.('[role="listbox"]')) return;
      if (e.key === "F2" && !cotizacion) buscarProductos();
      else if (e.key === "F4" && !cotizacion && !modoCotizar) setMostrarEspera(true);
      else if (e.key === "F6" && puedeCotizar) setMostrarCotizar(true);
      else if (e.key === "F8" && !modoCotizar) {
        setPestanaCaja("pago");
        setVistaCompacta("pago");
        requestAnimationFrame(() => document.getElementById("caja-monto-pago")?.focus());
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, [bloqueada, turnoActivo, modoCotizar, cotizacion, puedeCotizar, buscarProductos]);

  const enviarAEspera = async (evento?: FormEvent) => {
    evento?.preventDefault();
    // Evita el doble envío (Enter repetido o clic + Enter) mientras la petición sigue en curso.
    if (cart.length === 0 || enviandoRef.current) return;
    enviandoRef.current = true;
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
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  // Recuperar una venta en espera valida contra el stock ACTUAL de caja (no el guardado con la venta).
  // Si alguna línea se recorta, se pide confirmación y la venta sigue en espera si el usuario cancela.
  const recuperarEnEspera = async (v: VentaEnEspera) => {
    if (carrito.length) {
      toast.info("Guarda o limpia el ticket actual antes de recuperar otra venta.");
      return;
    }
    let vigentes = porId;
    try {
      const frescos = await productosApi.listar();
      setProductos(frescos);
      vigentes = new Map(frescos.filter((p) => p.activo && p.ventaPublico !== false).map((p) => [p.id, p]));
    } catch {
      // Sin conexión para refrescar: se valida con el último catálogo cargado.
    }
    const recuperado: CartItem[] = [];
    const recuperadas = new Map<string, number>();
    const ajustes: string[] = [];
    for (const it of v.items) {
      const producto = vigentes.get(it.productoId);
      const nombre = producto?.nombre ?? it.producto.nombre;
      if (!producto) {
        ajustes.push(`${nombre}: ya no está disponible para la venta`);
        continue;
      }
      const anteriores = recuperadas.get(it.productoId) ?? 0;
      const sinLimite = producto.inventariable === false || permiteSinStock;
      const cantidad = sinLimite ? it.cantidad : Math.max(0, Math.min(it.cantidad, producto.stockCaja - anteriores));
      if (cantidad < it.cantidad) {
        ajustes.push(cantidad > 0 ? `${nombre}: ${cantidad} de ${it.cantidad} unidades` : `${nombre}: sin stock en caja`);
      }
      if (cantidad <= 0) continue;
      // El descuento de la línea se ajusta en proporción a las unidades recuperadas (en pesos enteros).
      const descuento = pisoPesosEnteros(aCentavos(it.descuento) * cantidad / it.cantidad) / 100;
      const previo = agruparProductos ? recuperado.find((item) => item.productoId === it.productoId) : undefined;
      if (previo) {
        previo.cantidad += cantidad;
        previo.descuento += descuento;
      } else {
        recuperado.push({ id: it.id, productoId: it.productoId, nombre: producto.nombre, precioBase: producto.precioVenta, cantidad, descuento });
      }
      recuperadas.set(it.productoId, anteriores + cantidad);
    }
    if (!recuperado.length) {
      toast.error("La venta sigue en espera. Sus productos no tienen stock disponible en caja.");
      return;
    }
    if (ajustes.length) {
      setRecuperacionPendiente({ venta: v, items: recuperado, ajustes });
      return;
    }
    await aplicarRecuperacion(v, recuperado, false);
  };

  const aplicarRecuperacion = async (v: VentaEnEspera, recuperado: CartItem[], ajustada: boolean) => {
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      resetCompleto();
      setCarrito(recuperado);
      setClienteId(v.clienteId || "");
      setDescuentoTicket(aPesosEnteros(aCentavos(v.descuento)));
      setDocumento(v.tipoDocumento ?? null);
      setMostrarEspera(false);
      if (ajustada) toast.warning("El ticket se ajustó al stock disponible en caja.");
      toast.success("Venta recuperada");
      await cargar();
    } catch {
      toast.error("No se pudo recuperar la venta en espera. Actualiza la lista e inténtalo de nuevo.");
    }
  };

  const cobrar = async () => {
    if (modoCotizar || !turno || cotizacionSolicitada || cobrandoRef.current || cart.length === 0 || listaCargando || listaError || !stockValido || efectivoInsuficiente) return;
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
      cotizacionId: cotizacion?.id,
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

  if (!modoCotizar && turnoError && turno === undefined) {
    return (
      <CajaLayout>
        <div role="alert" className="mx-auto grid max-w-md place-items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-card">
          <span className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive" aria-hidden="true"><CircleAlert size={22} /></span>
          <p className="font-display text-lg font-semibold">No pudimos revisar el turno de caja</p>
          <p className="text-sm text-muted-foreground">{turnoError}. Revisa tu conexión: la caja podría seguir abierta.</p>
          <Button type="button" onClick={cargarTurno}><RefreshCw size={15} /> Reintentar</Button>
        </div>
      </CajaLayout>
    );
  }

  if (productos === null || (!modoCotizar && turno === undefined)) {
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

  if (turno === null && !modoCotizar) {
    return <AbrirTurnoCard onAbierto={(actual) => {
      sessionStorage.setItem(CLAVE_CAJA, actual.cajaId);
      setTurno(actual);
    }} />;
  }

  return (
    <CajaLayout operativa titulo={modoCotizar ? "Nueva cotización" : "Caja"}>
      {modoCotizar ? <section aria-label="Preparación de cotización" className="company-banner mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-hero-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardList size={18} /> Nueva cotización</p>
        <Button asChild size="sm" variant="outline" className="bg-card text-card-foreground"><Link to="/cotizaciones">Volver a cotizaciones</Link></Button>
      </section> : turno && <section aria-label="Turno activo" className="company-banner mb-3 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 text-hero-foreground">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold [overflow-wrap:anywhere]">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15" aria-hidden="true"><Receipt size={17} /></span>
          {turno.caja.nombre} · {turno.tipoTurno.nombre}
        </p>
        <p className="hidden min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-hero/90 px-2.5 py-1.5 text-xs text-hero-muted sm:flex">
          <Clock size={14} className="shrink-0" aria-hidden="true" />
          <span>Abierto el <time dateTime={turno.fechaApertura}>{new Date(turno.fechaApertura).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}</time></span>
          {turno.usuarioApertura && <span className="[overflow-wrap:anywhere]">· {turno.usuarioApertura.nombre}</span>}
        </p>
      </section>}

      {cotizacionSolicitada && <p role="status" className="mb-2 text-sm text-muted-foreground">Cargando cotización…</p>}
      {cotizacion ? (
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <p><strong>Cotización #{cotizacion.folio}</strong> · {cotizacion.clienteNombre} · {money(cotizacion.total)}</p>
          <Button type="button" size="sm" variant="outline" disabled={bloqueada} onClick={() => setConfirmarAnulacion(true)}>Quitar cotización de caja</Button>
          {!stockValido && <p className="basis-full text-destructive">Revisa la disponibilidad de los productos antes de cobrar.</p>}
        </div>
      ) : (
        <div role="group" aria-label="Acciones rápidas de caja" className="mb-2 flex shrink-0 flex-wrap gap-1.5">
          {!modoCotizar && <Button variant="outline" size="sm" disabled={bloqueada} onClick={() => setMostrarEspera(true)}>
            <Inbox size={15} /> En espera <kbd className="hidden text-xs text-muted-foreground sm:inline">F4</kbd>
          </Button>}
          <Button variant="outline" size="sm" disabled={!puedeCotizar} onClick={() => setMostrarCotizar(true)}
            title={!clienteId ? "Selecciona un cliente para cotizar" : undefined}>
            <ClipboardList size={15} /> Cotizar <kbd className="hidden text-xs text-muted-foreground sm:inline">F6</kbd>
          </Button>
          {!modoCotizar && !cart.length && <Button asChild variant="ghost" size="sm"><Link to="/cotizaciones">Ver cotizaciones</Link></Button>}
        </div>
      )}
      <div role="group" aria-label="Vista de caja" className="mb-2 grid shrink-0 grid-cols-2 gap-2 xl:hidden">
        <Button type="button" size="sm" variant={vistaCompacta === "productos" ? "default" : "outline"}
          aria-pressed={vistaCompacta === "productos"} onClick={() => setVistaCompacta("productos")}>Productos</Button>
        <Button type="button" size="sm" variant={vistaCompacta === "pago" ? "default" : "outline"}
          aria-pressed={vistaCompacta === "pago"} onClick={() => setVistaCompacta("pago")}>{modoCotizar ? "Cliente y cotización" : "Pago y opciones"}</Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,32%)]">
        <div className={cn("min-h-0 min-w-0 flex-col gap-2 xl:flex", vistaCompacta === "productos" ? "flex" : "hidden")}>
          {!cotizacion && <div className="grid min-w-0 shrink-0 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)]">
            <CajaBusqueda productos={disponibles} resultados={results} texto={q} alBuscar={setQ}
              alTecla={handleSearchKeyDown} agregar={addToCart} precio={precioEfectivo} permiteSinStock={permiteSinStock} bloqueado={bloqueada || listaCargando || listaError} />
            <Select value={listaPrecioId || LISTA_BASE} disabled={bloqueada}
              onValueChange={(v) => { setPreciosLista(null); setListaPrecioId(v === LISTA_BASE ? "" : v); }}>
              <SelectTrigger aria-label="Lista de precios" className="w-full bg-card data-[size=default]:h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={LISTA_BASE}>Lista de precios base</SelectItem>
                {listas.map((lista) => <SelectItem key={lista.id} value={lista.id}>{lista.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}

          {listaCargando && <p role="status" className="text-sm text-muted-foreground">Cargando precios de la lista…</p>}
          {listaError && (
            <p role="alert" className="text-sm text-destructive">
              No se pudieron cargar los precios. <button type="button" className="underline" onClick={() => setReintentoLista((n) => n + 1)}>Reintentar</button>
            </p>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-card">
            <CajaGrilla filas={cart} bloqueada={bloqueada || Boolean(cotizacion) || listaCargando || listaError}
              cambiarCantidad={changeQty} descuentosActivos={porcentajeMaximo > 0} editarDescuento={editarDescuentoLinea} quitar={removeItem} />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-secondary/50 px-3 py-2 sm:px-4">
              {!modoCotizar && <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Receipt size={18} /></span>
                <div>
                  <Label htmlFor="caja-documento" className="mb-1 text-xs text-muted-foreground">Documento de venta</Label>
                  <Select value={tipoDocumento} disabled={cobrando} onValueChange={(valor) => setDocumento(valor as DocumentoVenta)}>
                    <SelectTrigger id="caja-documento" size="sm" className="w-full bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(DOCUMENTOS_VENTA).map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>}
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn("text-left sm:text-right", !modoCotizar && "xl:hidden")}>
                  <p className="text-xs text-muted-foreground">{modoCotizar ? "Total cotizado" : cortesia ? "Total a cobrar" : "Total de la venta"}</p>
                  <p className="money font-display text-2xl font-bold leading-tight tabular-nums">{money(totalPago)}</p>
                  {descuentoTicketEnCentavos > 0 && <p className="text-xs text-muted-foreground">Descuento global {money(descuentoTicketNum)}</p>}
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Editar descuento global" title="Editar descuento global"
                  disabled={bloqueada || Boolean(cotizacion) || !cart.length || listaCargando || listaError || (porcentajeMaximo === 0 && !descuentoTicket)}
                  onClick={() => setDescuentoEditado({})}><Pencil size={16} /></Button>
              </div>
            </div>
          </div>
        </div>

        {modoCotizar ? <section className={cn("min-h-0 min-w-0 flex-col gap-4 overflow-y-auto rounded-2xl border bg-card p-4 shadow-card sm:p-5 xl:flex", vistaCompacta === "pago" ? "flex" : "hidden")}>
          <h2 className="font-display text-lg font-semibold">Cliente y propuesta</h2>
          <CajaCliente clientes={clientes} clienteId={clienteId} seleccionar={setClienteId} puedeCrear={tieneAcceso(usuario, { seccion: "clientes" })}
            creado={(cliente) => { setClientes((actual) => [...actual, cliente]); setClienteId(cliente.id); }} />
          <div className="brand-gradient rounded-xl p-4 text-white">
            <p className="text-sm">Total cotizado</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{money(total)}</p>
          </div>
          <Button type="button" disabled={!puedeCotizar} onClick={() => setMostrarCotizar(true)}>
            <ClipboardList size={16} /> Guardar propuesta
          </Button>
          {!clienteId && <p className="text-sm text-muted-foreground">Selecciona un cliente para guardar la cotización.</p>}
        </section> : <Tabs value={pestanaCaja} onValueChange={setPestanaCaja} className={cn("min-h-0 min-w-0 gap-2 xl:flex", vistaCompacta === "pago" ? "flex" : "hidden")}>
          <TabsList aria-label="Acciones de caja" className="h-11 w-full shrink-0 shadow-card">
            <TabsTrigger value="pago"><CreditCard size={16} /> Pago</TabsTrigger>
            <TabsTrigger value="opciones"><Settings2 size={16} /> Opciones</TabsTrigger>
          </TabsList>

          <TabsContent value="pago" className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-card data-[state=active]:flex data-[state=active]:flex-col">
            <header className="flex shrink-0 items-center gap-3 border-b bg-linear-to-r from-primary/12 via-primary/5 to-transparent px-4 py-3 sm:px-5">
              <span className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-card" aria-hidden="true"><ShoppingBag size={19} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base leading-tight font-bold">Cobro de la venta</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {cart.length ? `${cantidadTotal} ${cantidadTotal === 1 ? "unidad" : "unidades"} · ${cart.length} ${cart.length === 1 ? "producto" : "productos"}` : "Sin productos en el carrito"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-primary/25 bg-card px-2.5 py-1 text-[0.7rem] font-semibold text-primary xl:hidden">{nombreDocumento(tipoDocumento)}</span>
            </header>
            <fieldset disabled={bloqueada} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:px-5">
              <legend className="sr-only">Pago de la venta</legend>
              {cotizacion ? <p className="rounded-lg border px-3 py-2 text-sm">Cliente · <strong>{cotizacion.clienteNombre}</strong></p> :
                <CajaCliente clientes={clientes} clienteId={clienteId} seleccionar={setClienteId} puedeCrear={tieneAcceso(usuario, { seccion: "clientes" })}
                  creado={(cliente) => { setClientes((actual) => [...actual, cliente]); setClienteId(cliente.id); }} />}

              <div aria-label="Resumen de la venta" className="brand-gradient money rounded-xl px-4 py-3 text-sm text-white shadow-card">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-white/85">{cortesia ? "Total a cobrar" : descuentoAcumulado > 0 ? "Total con descuento" : "Total"}</span>
                  <strong className="font-display text-3xl leading-none tracking-tight tabular-nums">{money(totalPago)}</strong>
                </p>
                {!!cart.length && <details className="group mt-2 border-t border-white/25 pt-2">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-white/85 marker:content-none">
                    <ChevronDown size={14} className="group-open:rotate-180" aria-hidden="true" /> Ver desglose
                  </summary>
                  <dl className="mt-2 space-y-1 text-xs text-white/90">
                {descuentoAcumulado > 0 && (
                  <>
                    <div className="flex justify-between gap-2 text-white/80"><dt>Subtotal</dt><dd className="tabular-nums">{money(brutoEnCentavos / 100)}</dd></div>
                    <div className="flex justify-between gap-2 text-white/80"><dt>Descuento</dt><dd className="tabular-nums">−{money(descuentoAcumulado / 100)}</dd></div>
                  </>
                )}
                <div className="flex justify-between gap-2 text-white/80"><dt>Neto</dt><dd className="tabular-nums">{money(neto)}</dd></div>
                <div className="flex justify-between gap-2 text-white/80"><dt>IVA (19 %)</dt><dd className="tabular-nums">{money(iva)}</dd></div>
                {cortesia && <div className="flex justify-between gap-2 text-xs text-white/80"><dt>Valor de referencia</dt><dd className="tabular-nums">{money(total)}</dd></div>}
                  </dl>
                </details>}
              </div>

              <div className="space-y-2">
                <p id="caja-formas-pago" className="text-sm font-semibold">Forma de pago</p>
                <div role="group" aria-labelledby="caja-formas-pago" className="grid grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-1.5">
                  {METODOS.filter((metodo) => !cotizacion || metodo !== "cortesia").map((metodo) => {
                    const estilo = ESTILO_METODO[metodo];
                    const Icono = estilo.icono;
                    const activo = medio === metodo;
                    return (
                      <button key={metodo} type="button" aria-pressed={activo} onClick={() => elegirMedio(metodo)}
                        className={cn(
                          "flex min-h-10 items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-left text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
                          activo ? cn("shadow-card ring-2", estilo.activo) : estilo.hover,
                        )}>
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-md", estilo.chip)} aria-hidden="true"><Icono size={13} /></span>
                        <span className="flex w-full items-center justify-between gap-1">
                          {etiquetaMetodo(metodo)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {cortesia && (
                <div className="space-y-1.5">
                  <Label htmlFor="caja-motivo-cortesia">Motivo de la cortesía</Label>
                  <Input id="caja-motivo-cortesia" value={motivoCortesia}
                    onChange={(e) => setMotivoCortesia(e.target.value)} placeholder="Obligatorio, por ejemplo: degustación" />
                </div>
              )}

              {!cortesia && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="caja-monto-pago">Monto en {ETIQUETAS_PAGO[medio].toLowerCase()}</Label>
                    <div className="flex items-center gap-2">
                      <Input id="caja-monto-pago" type="number" min={0} step="1" inputMode="numeric" value={montoPago}
                        placeholder={montoInput(Math.max(0, saldo) / 100)} disabled={saldo <= 0} aria-invalid={montoPagoDecimal || undefined}
                        onChange={(e) => setMontoPago(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregarPago(); }}
                        className="money h-11 min-w-0 flex-1 text-right text-base font-semibold tabular-nums" />
                      <Button type="button" variant="outline" className="h-11 shrink-0 border-primary/35 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                        disabled={!Number.isFinite(montoPropuesto) || montoPropuesto <= 0 || montoPropuesto > saldo} onClick={agregarPago}><Plus size={16} /> Agregar al pago</Button>
                    </div>
                    {montoPagoDecimal && <p role="alert" className="text-xs text-destructive">Ingresa el monto en pesos enteros, sin decimales.</p>}
                  </div>
                  {!!pagos.length && (
                    <ul aria-label="Pagos agregados" className="divide-y rounded-xl border bg-muted/40 px-3">
                      {pagos.map((pago) => {
                        const estilo = ESTILO_METODO[pago.metodoPago as MedioCaja] ?? ESTILO_METODO.transferencia;
                        const Icono = estilo.icono;
                        return (
                          <li key={pago.metodoPago} className="flex items-center gap-2 py-1.5 text-sm">
                            <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", estilo.chip)} aria-hidden="true"><Icono size={13} /></span>
                            <span className="flex-1">{ETIQUETAS_PAGO[pago.metodoPago]}</span>
                            <strong className="money tabular-nums">{money(pago.monto / 100)}</strong>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Quitar pago en ${ETIQUETAS_PAGO[pago.metodoPago]}`}
                              onClick={() => { setPagos(pagos.filter((item) => item.metodoPago !== pago.metodoPago)); setMontoPago(""); }}><X size={15} /></Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {montoEfectivoVenta > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <Label htmlFor="caja-recibido">Efectivo recibido</Label>
                      <div className="flex gap-2">
                        <Input id="caja-recibido" type="number" min={0} step="1" value={recibido} inputMode="numeric"
                          onChange={(e) => { setPagoExacto(false); setMontoRecibido(e.target.value); }}
                          placeholder={montoInput(montoEfectivoVenta)} className="money h-11 min-w-0 text-right text-base font-semibold tabular-nums" />
                        <Button type="button" variant={pagoExacto ? "default" : "outline"} aria-pressed={pagoExacto} onClick={() => {
                          setMontoRecibido(montoInput(montoEfectivoVenta));
                          setPagoExacto(true);
                        }} className="h-11 shrink-0 px-3">Pago exacto</Button>
                      </div>
                      {recibido && diferenciaEfectivo >= 0 && (
                        <p role="status" className="flex items-baseline justify-between gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-success">
                          <span className="text-sm font-semibold">Vuelto</span>
                          <span className="money font-display text-2xl font-bold tabular-nums">{money(diferenciaEfectivo / 100)}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {cart.length > 0 && errorPago && <p role="status" className={cn("text-xs", saldo < 0 ? "text-destructive" : "text-muted-foreground")}>{errorPago}</p>}
                  {efectivoInsuficiente && <p role="status" className="text-xs text-destructive">El efectivo recibido es menor que el monto a cobrar en efectivo.</p>}
                </div>
              )}

            </fieldset>
            <div className="shrink-0 border-t bg-muted/30 px-4 py-3 sm:px-5">
              <Button type="button" onClick={cobrar} size="lg"
                className="brand-gradient h-14 w-full rounded-xl text-lg font-bold text-white shadow-card transition-shadow hover:shadow-card-hover disabled:opacity-55"
                disabled={cart.length === 0 || bloqueada || listaCargando || listaError || !stockValido || efectivoInsuficiente || (cortesia ? !motivoCortesia.trim() : !!errorPago)}>
                {cobrando ? "Procesando…" : cortesia
                  ? <><Gift size={20} aria-hidden="true" /> Registrar cortesía</>
                  : <><Receipt size={20} aria-hidden="true" /> Cobrar <span className="money">{money(total)}</span></>}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="opciones" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-2xl border bg-card p-4 shadow-card sm:p-5">
            <div className="grid gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground">Venta</h2>
              <Button type="button" variant="outline" disabled={bloqueada || Boolean(cotizacion) || !cart.length || listaCargando || listaError} className="justify-start"
                onClick={() => setMostrarEnviar(true)}><Send size={15} /> Enviar a espera</Button>
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
        </Tabs>}
      </div>

      {mostrarCotizar && puedeCotizar && <CotizarDialog
        base={{ clienteId, listaPrecioId: listaPrecioId || null, descuento: descuentoTicketNum, items: cart.map((it) => ({
          productoId: it.productoId, cantidad: it.cantidad, descuento: it.descuento,
        })) }}
        cliente={clientes.find((c) => c.id === clienteId)?.nombre ?? "Cliente seleccionado"} total={total}
        onClose={() => setMostrarCotizar(false)} onSave={(actual) => {
          setMostrarCotizar(false);
          toast.success(`Cotización #${actual.folio} guardada`);
          navigate(`/cotizaciones?detalle=${actual.id}`);
        }} />}
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
            <DialogTitle>{cotizacion ? "¿Quitar cotización de caja?" : "¿Anular venta en curso?"}</DialogTitle>
            <DialogDescription>{cotizacion ? "La cotización seguirá disponible en su historial." : "Se descartarán los productos, descuentos y pagos del carrito actual."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarAnulacion(false)}>Volver</Button>
            <Button type="button" variant="destructive" onClick={() => { resetCompleto(); setConfirmarAnulacion(false); }}>{cotizacion ? "Quitar de caja" : "Anular venta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {turno && mostrarCierre && (
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
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-success/15 text-success shrink-0" aria-hidden="true">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <DialogTitle>{comprobante.venta.esCortesia ? "Cortesía registrada" : "Venta registrada"}</DialogTitle>
                    <DialogDescription>{nombreDocumento(comprobante.venta.tipoDocumento)} N° {folioComprobante(comprobante.venta.id)}</DialogDescription>
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
                    <dt>{ETIQUETAS_PAGO[metodoPago] ?? metodoPago}</dt>
                    <dd className="money tabular-nums">{money(monto)}</dd>
                  </div>
                ))}
                {comprobante.vuelto > 0 && (
                  <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold text-success">
                    <dt>Vuelto</dt>
                    <dd className="money font-display text-2xl font-bold tabular-nums">{money(comprobante.vuelto)}</dd>
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

      <ConfirmDialog
        open={!!recuperacionPendiente}
        title="¿Recuperar con stock ajustado?"
        message={recuperacionPendiente
          ? `No hay stock suficiente en caja para toda la venta. ${recuperacionPendiente.ajustes.join("; ")}. Si continúas, el ticket se recupera ajustado y sale de la lista de espera; si cancelas, la venta sigue en espera sin cambios.`
          : ""}
        confirmLabel="Recuperar ajustada"
        onCancel={() => setRecuperacionPendiente(null)}
        onConfirm={() => {
          const pendiente = recuperacionPendiente;
          setRecuperacionPendiente(null);
          if (pendiente) void aplicarRecuperacion(pendiente.venta, pendiente.items, true);
        }}
      />

      {turno && movimientoCaja && (
        <MovimientoCajaDialog key={`${turno.id}:${movimientoCaja}`} turnoCajaId={turno.id}
          tipoInicial={movimientoCaja} onClose={() => setMovimientoCaja(null)} />
      )}

      <Dialog open={mostrarEnviar} onOpenChange={(o) => !o && !enviando && setMostrarEnviar(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar a espera</DialogTitle>
            <DialogDescription>Guarda este carrito para retomarlo después.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={enviarAEspera}>
            <div className="space-y-1.5">
              <Label htmlFor="caja-referencia-espera">Referencia (opcional)</Label>
              <Input
                id="caja-referencia-espera"
                autoFocus
                value={referenciaEnvio}
                onChange={(e) => setReferenciaEnvio(e.target.value)}
                placeholder="Ej. Mesa 3, nombre del cliente..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMostrarEnviar(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </CajaLayout>
  );
}
