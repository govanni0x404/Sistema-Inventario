import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Banknote, CalendarDays, LockKeyhole } from "lucide-react";
import { tiposTurnoApi } from "../api/tiposTurno";
import { turnosApi } from "../api/turnos";
import { cajasApi } from "../api/cajas";
import { ApiError } from "../api/client";
import type { Caja, TipoTurno, TurnoCaja } from "../types/turno";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fechaCompleta } from "@/lib/fechas";
import { money } from "@/lib/format";
import { useNegocio } from "@/context/NegocioContext";

const fechaLocal = () => new Date().toLocaleDateString("sv-SE");

export default function AbrirTurnoCard({ onAbierto }: { onAbierto: (turno: TurnoCaja) => void }) {
  const { negocio } = useNegocio();
  const [opciones, setOpciones] = useState<{ cajas: Caja[]; tipos: TipoTurno[] } | "error" | null>(null);
  const [intento, setIntento] = useState(0);
  const [cajaId, setCajaId] = useState("");
  const [tipoTurnoId, setTipoTurnoId] = useState("");
  const [montoInicial, setMontoInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [fecha, setFecha] = useState(fechaLocal);

  useEffect(() => {
    const actualizarFecha = () => setFecha(fechaLocal());
    const intervalo = window.setInterval(actualizarFecha, 1_000);
    window.addEventListener("focus", actualizarFecha);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizarFecha);
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    Promise.all([cajasApi.listar(), tiposTurnoApi.listar(true)])
      .then(([cajas, tipos]) => { if (vigente) setOpciones({ cajas, tipos }); })
      .catch(() => { if (vigente) setOpciones("error"); });
    return () => { vigente = false; };
  }, [intento]);

  const cajas = opciones && opciones !== "error" ? opciones.cajas : [];
  const tipos = opciones && opciones !== "error" ? opciones.tipos : [];
  const caja = cajaId ? cajas.find((item) => item.id === cajaId) : cajas[0];
  const tipo = tipoTurnoId || (tipos.length === 1 ? tipos[0].id : "");
  const turnoAbierto = caja?.turnoAbierto;
  const continuar = Boolean(turnoAbierto);
  const datosEmpresa = [
    { etiqueta: "RUT", valor: negocio.rut?.trim() || "Sin registrar" },
    { etiqueta: "Giro", valor: negocio.giro },
    { etiqueta: "Dirección", valor: negocio.direccion },
    { etiqueta: "Teléfono", valor: negocio.telefono },
    { etiqueta: "Correo", valor: negocio.email },
  ].filter(({ valor }) => valor?.trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!caja || abriendo || (!continuar && (!tipo || !montoInicial))) return;
    setAbriendo(true);
    try {
      const turno = continuar ? await turnosApi.actual(caja.id) : await turnosApi.abrir({
        cajaId: caja.id,
        tipoTurnoId: tipo,
        montoInicial: Number(montoInicial),
      });
      if (!turno) {
        toast.info("El turno se cerró. Selecciona un turno para volver a abrir esta caja.");
        setIntento((n) => n + 1);
        return;
      }
      if (!continuar) toast.success("Caja abierta");
      onAbierto(turno);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir el turno");
      if (e instanceof ApiError && [404, 409].includes(e.status)) setIntento((n) => n + 1);
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <section aria-labelledby="apertura-caja" className="cash-opening caja-vista-fija grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] place-items-center px-4 py-12 sm:px-6">
      <Card className="max-h-full w-full max-w-[48rem] gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.75rem] border-white/25 shadow-2xl">
        <CardHeader className="shrink-0 gap-0 bg-linear-to-br from-hero to-sidebar-accent p-5 text-hero-foreground sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground" aria-hidden="true">
                <LockKeyhole size={20} />
              </span>
              <h1 id="apertura-caja" className="font-display text-2xl leading-tight font-bold tracking-tight sm:text-3xl">Abrir caja</h1>
            </div>
            <time dateTime={fecha} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-3 py-2 text-sm font-medium">
              <CalendarDays size={16} className="shrink-0 text-sidebar-primary" aria-hidden="true" />
              {fechaCompleta(fecha)}
            </time>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/15 bg-white/8 p-4 sm:p-5">
            <p className="text-sm text-hero-muted">Empresa</p>
            <p className="mt-1 font-display text-3xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{negocio.nombre}</p>
            {datosEmpresa.length > 0 && (
              <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                {datosEmpresa.map(({ etiqueta, valor }) => (
                  <div key={etiqueta} className="min-w-0">
                    <dt className="text-xs text-hero-muted">{etiqueta}</dt>
                    <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </CardHeader>
        <CardContent className="shrink-0 p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="apertura-caja-registro" className="text-base">Caja</Label>
                <Select value={caja?.id ?? ""} onValueChange={(id) => { setCajaId(id); setMontoInicial(""); }} disabled={abriendo || !cajas.length}>
                  <SelectTrigger id="apertura-caja-registro" className="w-full px-4 text-lg font-semibold data-[size=default]:h-15">
                    <SelectValue placeholder="Selecciona una caja" />
                  </SelectTrigger>
                  <SelectContent>
                    {cajas.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.nombre}{item.turnoAbierto ? " · Abierta" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="apertura-tipo-turno" className="text-base">Tipo de turno</Label>
                <Select value={continuar ? "" : tipo} onValueChange={setTipoTurnoId} disabled={abriendo || continuar || !tipos.length}>
                  <SelectTrigger id="apertura-tipo-turno" className="w-full px-4 text-lg font-semibold data-[size=default]:h-15">
                    <SelectValue placeholder={turnoAbierto?.nombre ?? "Selecciona un turno"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid items-center gap-4 rounded-xl border bg-muted/55 p-4 sm:grid-cols-2 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Banknote size={20} /></span>
                <div>
                  {turnoAbierto
                    ? <p className="text-base font-semibold">Fondo inicial del turno</p>
                    : <Label htmlFor="apertura-fondo" className="text-base">Fondo fijo de apertura</Label>}
                  <p id="apertura-fondo-ayuda" className="mt-1 text-sm text-muted-foreground">{turnoAbierto ? "Registrado al abrir la caja" : "Ingresa el efectivo con el que partes."}</p>
                </div>
              </div>
              {turnoAbierto ? (
                <p className="font-display text-2xl font-bold tabular-nums sm:text-right">{money(turnoAbierto.montoInicial)}</p>
              ) : (
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted-foreground">$</span>
                  <Input id="apertura-fondo" aria-describedby="apertura-fondo-ayuda" type="number" min="0" max="99999999.99"
                    step="0.01" inputMode="decimal" placeholder="0" className="h-14 pl-9 text-lg font-semibold tabular-nums md:text-lg"
                    value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} required disabled={!caja || abriendo} />
                </div>
              )}
            </div>
            {!opciones && <p role="status" className="text-sm text-muted-foreground">Cargando cajas y turnos…</p>}
            {opciones === "error" && (
              <p role="alert" className="text-sm text-destructive">No se pudieron cargar las opciones. <button type="button" className="underline" onClick={() => { setOpciones(null); setIntento((n) => n + 1); }}>Reintentar</button></p>
            )}
            {opciones && opciones !== "error" && caja && !continuar && !tipos.length && (
              <p className="text-sm text-muted-foreground">Pídele a un administrador que configure un tipo de turno en Mantención → Turnos.</p>
            )}
            <Button type="submit" disabled={abriendo || !caja || (!continuar && (!tipo || !montoInicial))} className="h-12 w-full text-base font-semibold">
              {abriendo ? "Un momento…" : continuar ? "Continuar turno" : "Abrir caja"}
              {!abriendo && <ArrowRight size={16} aria-hidden="true" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
