import { useEffect, useState } from "react";
import { Clock, Download } from "lucide-react";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import type { TurnoCaja } from "../types/turno";
import { useAuth } from "../context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TipoTurnoManager from "../components/TipoTurnoManager";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";
import { exportarCsv } from "../lib/exportCsv";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function TurnosPage() {
  const { usuario } = useAuth();
  const [turnos, setTurnos] = useState<TurnoCaja[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<TurnoCaja | null>(null);

  const cargar = async () => {
    try {
      setLoadError(null);
      setTurnos(await turnosApi.listar());
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(turnos ?? [], 10);

  const abrirDetalle = async (t: TurnoCaja) => {
    try {
      setDetalle(await turnosApi.obtener(t.id));
    } catch {
      setDetalle(t);
    }
  };

  const exportar = () => {
    if (!turnos || turnos.length === 0) return;
    exportarCsv(
      `turnos-caja-${new Date().toISOString().slice(0, 10)}.csv`,
      turnos.map((t) => ({
        Tipo: t.tipoTurno.nombre,
        Estado: t.estado,
        Apertura: new Date(t.fechaApertura).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
        Cierre: t.fechaCierre ? new Date(t.fechaCierre).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "",
        "Usuario apertura": t.usuarioApertura?.nombre ?? "",
        "Usuario cierre": t.usuarioCierre?.nombre ?? "",
        "Monto inicial": t.montoInicial,
        "Monto contado": t.montoContado ?? "",
        "Monto esperado": t.montoEsperado ?? "",
        Diferencia: t.diferencia ?? "",
      }))
    );
  };

  return (
    <div className="space-y-6">
      {usuario?.rol === "admin" && <TipoTurnoManager onChange={cargar} />}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-semibold text-foreground">Historial de turnos</h3>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!turnos || turnos.length === 0}>
            <Download size={14} /> Exportar CSV
          </Button>
        </div>

        {loadError && (
          <div className="font-body text-sm text-center py-10 text-destructive">
            {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
          </div>
        )}
        {!loadError && turnos === null && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {!loadError && turnos !== null && turnos.length === 0 && (
          <div className="font-body text-sm text-center py-10 text-muted-foreground">
            Aún no hay turnos registrados. Ábrelo desde <span className="text-foreground">Caja</span>.
          </div>
        )}

        {!loadError && turnos && turnos.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => abrirDetalle(t)}>
                    <TableCell className="font-body text-sm font-medium text-foreground">{t.tipoTurno.nombre}</TableCell>
                    <TableCell className="font-body text-xs text-muted-foreground">
                      {new Date(t.fechaApertura).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                    <TableCell className="font-body text-xs text-muted-foreground">{t.usuarioApertura?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.estado === "abierto" ? "success" : "outline"} className="capitalize">
                        {t.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {t.diferencia === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={t.diferencia < 0 ? "text-destructive" : t.diferencia > 0 ? "text-primary" : "text-muted-foreground"}>
                          {t.diferencia > 0 ? "+" : ""}
                          {money(t.diferencia)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="sm:max-w-lg">
          {detalle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                    <Clock size={17} />
                  </span>
                  <div>
                    <DialogTitle>{detalle.tipoTurno.nombre}</DialogTitle>
                    <p className="font-body text-xs text-muted-foreground">
                      {new Date(detalle.fechaApertura).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                      {detalle.fechaCierre && ` → ${new Date(detalle.fechaCierre).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="font-body text-xs text-muted-foreground">Abrió</div>
                  <div className="font-body text-sm text-foreground">{detalle.usuarioApertura?.nombre ?? "—"}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="font-body text-xs text-muted-foreground">Cerró</div>
                  <div className="font-body text-sm text-foreground">{detalle.usuarioCierre?.nombre ?? "—"}</div>
                </div>
              </div>

              {detalle.resumenVentas && (
                <div>
                  <div className="font-body text-xs font-medium text-muted-foreground mb-2">Ventas del turno</div>
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden font-body text-sm">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Efectivo</span>
                      <span className="font-mono text-foreground">{money(detalle.resumenVentas.porMetodo.efectivo)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Tarjeta</span>
                      <span className="font-mono text-foreground">{money(detalle.resumenVentas.porMetodo.tarjeta)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Transferencia</span>
                      <span className="font-mono text-foreground">{money(detalle.resumenVentas.porMetodo.transferencia)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 font-semibold">
                      <span>Total ({detalle.resumenVentas.cantidadVentas} venta(s))</span>
                      <span className="font-mono">{money(detalle.resumenVentas.total)}</span>
                    </div>
                    {(() => {
                      const d = detalle.resumenVentas.devolucionesPorMetodo;
                      const totalDev = d ? d.efectivo + d.tarjeta + d.transferencia : 0;
                      if (!d || totalDev <= 0) return null;
                      return (
                        <div className="flex justify-between px-3 py-2">
                          <span className="text-muted-foreground">
                            Devoluciones (efectivo {money(d.efectivo)} · otros {money(d.tarjeta + d.transferencia)})
                          </span>
                          <span className="font-mono text-destructive">-{money(totalDev)}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {detalle.estado === "cerrado" && (
                <div className="rounded-xl border border-border p-3 font-body text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fondo inicial</span>
                    <span className="font-mono text-foreground">{money(detalle.montoInicial)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Esperado en caja</span>
                    <span className="font-mono text-foreground">{money(detalle.montoEsperado ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contado</span>
                    <span className="font-mono text-foreground">{money(detalle.montoContado ?? 0)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1.5 border-t border-border">
                    <span>Diferencia</span>
                    <span className={`font-mono ${(detalle.diferencia ?? 0) < 0 ? "text-destructive" : "text-primary"}`}>
                      {(detalle.diferencia ?? 0) > 0 ? "+" : ""}
                      {money(detalle.diferencia ?? 0)}
                    </span>
                  </div>
                  {detalle.notas && <p className="text-muted-foreground pt-1.5 border-t border-border">{detalle.notas}</p>}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
