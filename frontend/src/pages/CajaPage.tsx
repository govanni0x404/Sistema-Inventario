import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PropsWithChildren } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Clock, CreditCard, Inbox, LogOut, Pencil, Printer, Receipt, Send, Settings2, SplitSquareHorizontal, X } from "lucide-react";
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
import type { MetodoPago, Venta, VentaInput } from "../types/venta";
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
import CerrarTurnoDialog from "../components/CerrarTurnoDialog";
import VentasEnEsperaDialog from "../components/VentasEnEsperaDialog";
import MovimientoCajaDialog from "../components/MovimientoCajaDialog";
import { folioComprobante, printTicket } from "../lib/printTicket";
import { useNegocio } from "../context/NegocioContext";
import { useAuth } from "../context/AuthContext";
import { tieneAcceso } from "../components/nav-data";
import { aCentavos, LOCALE, money, montoInput } from "../lib/format";
import { matchesSearch, normalizeSearch } from "../lib/search";


type CartItem = { productoId: string; nombre: string; precioBase: number; cantidad: number; descuento: number };

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];
const CLIENTE_GENERAL = "__general__";
const LISTA_BASE = "__base__";
const SIN_OVERRIDES: Record<string, number> = {};
const CLAVE_CAJA = "inventario_caja_actual";
const MAX_CANTIDAD = 2_147_483_647;

function CajaLayout({ children, operativa = false }: PropsWithChildren<{ operativa?: boolean }>) {
  return (
    <div className={operativa
      ? "caja-vista-fija flex min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3"
      : "mx-auto w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"}>
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
  const [pagos, setPagos] = useState<{ metodoPago: MetodoPago; monto: string }[]>([{ metodoPago: "efectivo", monto: "" }]);
  const [cortesia, setCortesia] = useState(false);
  const [motivoCortesia, setMotivoCortesia] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [pagoExacto, setPagoExacto] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const cobrandoRef = useRef(false);
  const intentoVenta = useRef<{ firma: string; clave: string } | null>(null);
  const [descuentoTicket, setDescuentoTicket] = useState("");
  const [descuentoBorrador, setDescuentoBorrador] = useState<string | null>(null);
  const [confirmarAnulacion, setConfirmarAnulacion] = useState(false);
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [comprobante, setComprobante] = useState<{ venta: Venta; vuelto: number } | null>(null);
  const { negocio } = useNegocio();
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
  const cart = carrito.map((item) => {
    const producto = porId.get(item.productoId);
    const precio = overridePrecios[item.productoId] ?? producto?.precioVenta ?? item.precioBase;
    const brutoEnCentavos = aCentavos(precio) * item.cantidad;
    const descuentoEnCentavos = Math.min(aCentavos(item.descuento), brutoEnCentavos);
    return {
      ...item,
      codigo: producto?.codigoBarras || producto?.sku || "—",
      precio,
      stockMax: producto?.inventariable === false ? MAX_CANTIDAD : producto?.stockCaja ?? 0,
      gravado: producto?.tipoImpuesto !== "exento",
      brutoEnCentavos,
      descuentoEnCentavos,
      descuento: descuentoEnCentavos / 100,
    };
  });

  const results = useMemo(() => {
    const term = normalizeSearch(q);
    if (!term) return [];
    return disponibles.filter((p) => matchesSearch(term, [p.nombre, p.sku, p.codigoBarras])).slice(0, 8);
  }, [q, disponibles]);

  // Un lector de código de barras escribe rápido y termina con Enter: si el texto coincide
  // exacto con un código de barras o SKU, se agrega directo sin requerir un clic.
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || cobrandoRef.current || listaCargando || listaError) return;
    const term = q.trim();
    if (!term) return;
    const match =
      disponibles.find((p) => p.codigoBarras === term) ||
      disponibles.find((p) => p.sku.toLowerCase() === term.toLowerCase());
    if (match) {
      addToCart(match);
    } else if (results.length === 1) {
      addToCart(results[0]);
    } else {
      toast.error("Producto no encontrado");
    }
  };

  const addToCart = (p: Producto) => {
    const enCarrito = carrito.find((c) => c.productoId === p.id);
    const disponible = (p.inventariable === false ? MAX_CANTIDAD : p.stockCaja) - (enCarrito?.cantidad ?? 0);
    if (disponible <= 0) {
      toast.error("Sin stock disponible");
      return;
    }
    if (enCarrito) {
      setCarrito(carrito.map((c) => c.productoId === p.id ? { ...c, cantidad: c.cantidad + 1 } : c));
    } else {
      setCarrito([...carrito, { productoId: p.id, nombre: p.nombre, precioBase: p.precioVenta, cantidad: 1, descuento: 0 }]);
    }
    setQ("");
  };

  const changeDescuentoItem = (id: string, valor: string) => {
    setCarrito(
      cart.map((c) => {
        if (c.productoId !== id) return c;
        const descuento = Math.max(0, Math.min(c.brutoEnCentavos, aCentavos(Number(valor) || 0))) / 100;
        return { ...c, descuento };
      })
    );
  };

  const changeQty = (id: string, delta: number) => {
    const item = cart.find((c) => c.productoId === id);
    if (!item) return;
    const cantidad = item.cantidad + delta;
    if (cantidad < 1 || (delta > 0 && cantidad > item.stockMax)) return;
    const descuento = Math.min(item.descuentoEnCentavos, aCentavos(item.precio) * cantidad) / 100;
    setCarrito(carrito.map((c) => c.productoId === id ? { ...c, cantidad, descuento } : c));
  };
  const removeItem = (id: string) => setCarrito(carrito.filter((c) => c.productoId !== id));

  const brutoEnCentavos = cart.reduce((s, c) => s + c.brutoEnCentavos, 0);
  const descuentoItemsEnCentavos = cart.reduce((s, c) => s + c.descuentoEnCentavos, 0);
  const subtotalEnCentavos = brutoEnCentavos - descuentoItemsEnCentavos;
  const descuentoTicketEnCentavos = Math.max(0, Math.min(subtotalEnCentavos, aCentavos(Number(descuentoTicket) || 0)));
  const totalEnCentavos = subtotalEnCentavos - descuentoTicketEnCentavos;
  const descuentoTicketNum = descuentoTicketEnCentavos / 100;
  const subtotal = subtotalEnCentavos / 100;
  const total = totalEnCentavos / 100;
  const totalPago = Math.round(cortesia ? 0 : total);
  const subtotalGravado = cart.reduce((suma, linea) => suma + (linea.gravado ? linea.brutoEnCentavos - linea.descuentoEnCentavos : 0), 0);
  const iva = subtotalEnCentavos > 0 ? Math.round(totalPago * (subtotalGravado / subtotalEnCentavos) * 19 / 119) : 0;
  const neto = totalPago - iva;

  const dividido = pagos.length === 2;
  const montos = dividido ? pagos.map((p) => aCentavos(Number(p.monto) || 0)) : [totalEnCentavos];
  const sumaPagos = montos.reduce((total, monto) => total + monto, 0);
  const errorPago = totalEnCentavos <= 0 ? "El total debe ser mayor que cero. Usa cortesía si corresponde."
    : montos.some((m) => m <= 0) ? "Indica un monto mayor que cero en cada forma de pago."
    : sumaPagos !== totalEnCentavos ? `Los pagos deben sumar ${money(total)}.`
    : null;
  const stockValido = cart.every((c) => c.cantidad <= c.stockMax);

  // Cuánto de la venta se paga en efectivo (para calcular el vuelto). Si no está
  // dividido y el único método es efectivo, es el total completo.
  const montoEfectivoVenta = dividido
    ? Number(pagos.find((p) => p.metodoPago === "efectivo")?.monto) || 0
    : pagos[0].metodoPago === "efectivo"
      ? total
      : 0;
  const recibido = pagoExacto ? montoInput(montoEfectivoVenta) : montoRecibido;
  const diferenciaEfectivo = aCentavos(Number(recibido)) - aCentavos(montoEfectivoVenta);
  const efectivoInsuficiente = !cortesia && montoEfectivoVenta > 0 && recibido !== "" && diferenciaEfectivo < 0;

  const setMetodoPago = (idx: 0 | 1, metodoPago: MetodoPago) => {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, metodoPago } : p)));
  };

  const setMontoPago = (idx: 0 | 1, valor: string) => {
    setPagos((prev) => {
      if (prev.length < 2) return prev;
      const otro = idx === 0 ? 1 : 0;
      const ingresado = aCentavos(Number(valor) || 0);
      const num = Math.max(0, Math.min(totalEnCentavos, ingresado));
      const siguiente = [...prev];
      siguiente[idx] = { ...siguiente[idx], monto: num === ingresado ? valor : montoInput(num / 100) };
      siguiente[otro] = { ...siguiente[otro], monto: montoInput((totalEnCentavos - num) / 100) };
      return siguiente;
    });
  };

  const dividirPago = () => {
    setPagos((prev) => [
      { ...prev[0], monto: montoInput(total) },
      { metodoPago: prev[0].metodoPago === "efectivo" ? "tarjeta" : "efectivo", monto: "0" },
    ]);
  };

  const quitarDivision = () => setPagos((prev) => [{ ...prev[0], monto: "" }]);

  // "Venta nueva": resetea todo el ticket (carrito, cliente, formas de pago, descuento).
  const resetCompleto = () => {
    setCarrito([]);
    intentoVenta.current = null;
    setClienteId("");
    setPagos([{ metodoPago: "efectivo", monto: "" }]);
    setDescuentoTicket("");
    setCortesia(false);
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
    const recuperado = v.items.flatMap((it) => {
      const cantidad = it.producto.inventariable === false ? it.cantidad : Math.min(it.cantidad, it.producto.stockCaja ?? 0);
      if (!it.producto.activo || it.producto.ventaPublico === false || cantidad <= 0) return [];
      return [{ productoId: it.productoId, nombre: it.producto.nombre, precioBase: it.producto.precioVenta, cantidad, descuento: it.descuento }];
    });
    if (!recuperado.length) {
      toast.error("La venta sigue en espera. Sus productos no tienen stock disponible en caja.");
      return;
    }
    try {
      await ventasEnEsperaApi.eliminar(v.id);
      resetCompleto();
      setCarrito(recuperado);
      setClienteId(v.clienteId || "");
      setDescuentoTicket(v.descuento > 0 ? String(v.descuento) : "");
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
      esCortesia: cortesia,
      motivoCortesia: cortesia ? motivoCortesia.trim() : undefined,
      pagos: cortesia ? undefined : pagos.map((p, i) => ({ metodoPago: p.metodoPago, monto: montos[i] / 100 })),
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
      <section aria-label="Turno activo" className="mb-2 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border bg-card px-3 py-1.5">
        <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{turno.caja.nombre} · {turno.tipoTurno.nombre}</p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <Clock size={14} className="shrink-0 text-primary" aria-hidden="true" />
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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={cn("min-h-0 min-w-0 flex-col gap-2 xl:flex", vistaCompacta === "productos" ? "flex" : "hidden")}>
          <div className="grid min-w-0 shrink-0 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)]">
            <CajaBusqueda productos={disponibles} resultados={results} texto={q} alBuscar={setQ}
              alTecla={handleSearchKeyDown} agregar={addToCart} precio={precioEfectivo} bloqueado={cobrando || listaCargando || listaError} />
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
              cambiarCantidad={changeQty} cambiarDescuento={changeDescuentoItem} quitar={removeItem} />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/25 px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Receipt size={18} /></span>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de documento</p>
                  <p className="text-sm font-semibold">Comprobante interno</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">{cortesia ? "Total a cobrar" : "Total de la venta"}</p>
                  <p className="font-display text-2xl font-bold leading-tight tabular-nums">{money(totalPago)}</p>
                  {descuentoTicketEnCentavos > 0 && <p className="text-xs text-muted-foreground">Descuento global {money(descuentoTicketNum)}</p>}
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Editar descuento global" title="Editar descuento global"
                  disabled={cobrando || !cart.length || listaCargando || listaError}
                  onClick={() => setDescuentoBorrador(descuentoTicketNum ? montoInput(descuentoTicketNum) : "")}><Pencil size={16} /></Button>
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
              <dl className="space-y-2 rounded-xl border bg-muted/45 p-3 text-sm">
                <div className="flex justify-between gap-2 text-muted-foreground"><dt>Neto estimado</dt><dd className="tabular-nums">{money(neto)}</dd></div>
                <div className="flex justify-between gap-2 text-muted-foreground"><dt>IVA estimado (19 % incluido)</dt><dd className="tabular-nums">{money(iva)}</dd></div>
                <div className="flex items-baseline justify-between gap-2 border-t pt-2 font-semibold">
                  <dt>Total a cobrar</dt><dd className="font-display text-2xl font-bold tabular-nums">{money(totalPago)}</dd>
                </div>
                {cortesia && <div className="flex justify-between gap-2 text-xs text-muted-foreground"><dt>Valor de referencia</dt><dd>{money(total)}</dd></div>}
              </dl>

              <div className="space-y-1.5">
                <Label htmlFor="caja-cliente">Cliente</Label>
                <Select value={clienteId || CLIENTE_GENERAL} onValueChange={(v) => setClienteId(v === CLIENTE_GENERAL ? "" : v)} disabled={cobrando}>
                  <SelectTrigger id="caja-cliente" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLIENTE_GENERAL}>Cliente general</SelectItem>
                    {clientes.map((cliente) => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={cortesia} onChange={(e) => setCortesia(e.target.checked)} className="size-4 accent-primary" />
                Venta de cortesía
              </label>
              {cortesia && <Input aria-label="Motivo de la cortesía" value={motivoCortesia}
                onChange={(e) => setMotivoCortesia(e.target.value)} placeholder="Motivo de la cortesía (obligatorio)" />}

              {!cortesia && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Forma de pago</p>
                  {pagos.map((pago, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
                          {METODOS.map((metodo) => (
                            <Button type="button" key={metodo} size="sm" variant={pago.metodoPago === metodo ? "default" : "outline"}
                              disabled={dividido && pagos[idx === 0 ? 1 : 0]?.metodoPago === metodo}
                              aria-pressed={pago.metodoPago === metodo} onClick={() => setMetodoPago(idx as 0 | 1, metodo)}
                              className="min-w-0 px-1 text-xs capitalize">{metodo}</Button>
                          ))}
                        </div>
                        {idx === 1 && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={quitarDivision} aria-label="Quitar segunda forma de pago"><X size={14} /></Button>}
                      </div>
                      {dividido && <Input type="number" min={0} max={total} step="0.01" aria-label={`Monto del pago ${idx + 1}`}
                        value={pago.monto} onChange={(e) => setMontoPago(idx as 0 | 1, e.target.value)} className="text-right tabular-nums" />}
                    </div>
                  ))}
                  {!dividido && <Button type="button" variant="ghost" size="sm" onClick={dividirPago} disabled={!cart.length} className="px-2 text-xs">
                    <SplitSquareHorizontal size={14} /> Dividir pago</Button>}
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
                  {cart.length > 0 && errorPago && <p role="status" className="text-xs text-destructive">{errorPago}</p>}
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

      <Dialog open={descuentoBorrador !== null} onOpenChange={(open) => !open && setDescuentoBorrador(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Descuento global</DialogTitle>
            <DialogDescription>Subtotal después de descuentos por producto: {money(subtotal)}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            setDescuentoTicket(descuentoBorrador ?? "");
            setDescuentoBorrador(null);
          }}>
            <div className="space-y-1.5">
              <Label htmlFor="caja-descuento">Monto del descuento</Label>
              <Input autoFocus id="caja-descuento" type="number" min={0} max={subtotal} step="0.01"
                value={descuentoBorrador ?? ""} onChange={(e) => setDescuentoBorrador(e.target.value)} placeholder="0" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDescuentoBorrador(null)}>Cancelar</Button>
              <Button type="submit">Aplicar descuento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
