import { useEffect, useState } from "react";
import { auditoriaApi } from "../api/auditoria";
import { ApiError } from "../api/client";
import type { RegistroAuditoria } from "../types/auditoria";
import type { RangoPreset } from "../components/RangoFechasSelector";
import RangoFechasSelector from "../components/RangoFechasSelector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LOCALE } from "../lib/format";
import { hoyStr, validarRango } from "../lib/fechas";

type Resultado = { clave: string; data: RegistroAuditoria[] } | { clave: string; error: string };

const ETIQUETAS: Record<string, string> = {
  recuperacion_solicitada: "Solicitud de recuperación de clave",
  login_exitoso: "Inicio de sesión",
  login_fallido: "Inicio de sesión fallido",
  usuario_rol_cambiado: "Cambio de rol",
  usuario_activo_cambiado: "Cambio de estado",
  password_reseteada: "Contraseña reseteada",
  permiso_actualizado: "Permiso actualizado",
  rol_renombrado: "Rol renombrado",
  lista_precio_eliminada: "Lista de precios eliminada",
  compra_creada: "Orden de compra creada",
  compra_editada: "Orden de compra editada",
  compra_emitida: "Orden de compra emitida",
  compra_cerrada: "Orden de compra cerrada con saldo",
  compra_anulada: "Orden de compra anulada",
  compra_recepcion: "Recepción de compra",
  compra_devolucion: "Devolución a proveedor",
  stock_minimo_actualizado: "Mínimo de bodega actualizado",
  merma_registrada: "Merma registrada",
  cotizacion_creada: "Cotización registrada",
  cotizacion_anulada: "Cotización anulada",
  cotizacion_cobrada: "Cotización cobrada",
};

function etiqueta(accion: string) {
  return ETIQUETAS[accion] || accion;
}

function esFallido(accion: string) {
  return accion === "login_fallido";
}

export default function AuditoriaPage() {
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr);
  const [hastaCustom, setHastaCustom] = useState(hoyStr);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const desde = rango === "custom" ? desdeCustom : "";
  const hasta = rango === "custom" ? hastaCustom : "";
  const rangoInvalido = rango === "custom" ? validarRango(desde, hasta) : null;
  const clave = `${rango}:${desde}:${hasta}:${intento}`;

  useEffect(() => {
    if (rangoInvalido) return;
    // Solo se aplica la respuesta de la consulta vigente (descarta respuestas de rangos anteriores).
    let vigente = true;
    auditoriaApi
      .listar(rango === "custom" ? { desde, hasta } : { dias: Number(rango) })
      .then((data) => { if (vigente) setResultado({ clave, data }); })
      .catch((error) => {
        if (vigente) setResultado({ clave, error: error instanceof ApiError ? error.message : "No se pudo conectar con el servidor." });
      });
    return () => { vigente = false; };
  }, [rangoInvalido, rango, desde, hasta, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const registros = actual && "data" in actual ? actual.data : null;
  const error = actual && "error" in actual ? actual.error : null;
  const cargando = !actual && !rangoInvalido;

  return (
    <div className="space-y-4">
      <RangoFechasSelector rango={rango} setRango={setRango} desdeCustom={desdeCustom} setDesdeCustom={setDesdeCustom} hastaCustom={hastaCustom} setHastaCustom={setHastaCustom} />

      {rangoInvalido && <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{rangoInvalido}</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-4">
          <p className="text-sm text-destructive">No se pudo cargar el registro de auditoría. {error}</p>
          <Button variant="outline" size="sm" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
        </div>
      )}
      {cargando && (
        <div role="status" aria-label="Cargando auditoría" className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {registros && registros.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">Sin eventos en este periodo.</div>
      )}
      {registros && registros.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Afectado</TableHead>
                <TableHead>Antes → Después</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.fecha).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={esFallido(r.accion) ? "destructive" : "secondary"}>{etiqueta(r.accion)}</Badge>
                  </TableCell>
                  <TableCell className="font-body text-sm text-foreground">{r.usuario?.nombre ?? "—"}</TableCell>
                  <TableCell className="font-body text-sm text-foreground">{r.usuarioAfectado?.nombre ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.valorAnterior || r.valorNuevo ? `${r.valorAnterior ?? "—"} → ${r.valorNuevo ?? "—"}` : "—"}
                  </TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">{r.detalle ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
