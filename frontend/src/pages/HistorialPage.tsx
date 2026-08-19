import { useEffect, useState } from "react";
import { ventasApi } from "../api/ventas";
import { clientesApi } from "../api/clientes";
import { turnosApi } from "../api/turnos";
import { ApiError } from "../api/client";
import type { Venta, MetodoPago } from "../types/venta";
import type { Cliente } from "../types/cliente";
import type { TurnoCaja } from "../types/turno";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import VentaDetalleModal from "../components/VentaDetalleModal";
import DataPagination from "../components/DataPagination";
import { usePagedList } from "../hooks/usePagedList";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];
const TODOS = "__todos__";

function hoyStr() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function HistorialPage() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [turnos, setTurnos] = useState<TurnoCaja[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [fecha, setFecha] = useState(hoyStr());
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [turnoCajaId, setTurnoCajaId] = useState("");

  const cargar = async () => {
    try {
      setLoadError(null);
      const [v, c, t] = await Promise.all([
        ventasApi.listar({
          fecha: fecha || undefined,
          clienteId: clienteId || undefined,
          metodoPago: metodoPago || undefined,
          turnoCajaId: turnoCajaId || undefined,
        }),
        clientesApi.listar(),
        turnosApi.listar(),
      ]);
      setVentas(v);
      setClientes(c);
      setTurnos(t);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, clienteId, metodoPago, turnoCajaId]);

  const nombreCliente = (v: Venta) => v.cliente?.nombre || "Cliente general";

  const nombreTurno = (t: TurnoCaja) =>
    `${t.tipoTurno.nombre} · ${new Date(t.fechaApertura).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}${
      t.estado === "abierto" ? " (abierto)" : ""
    }`;

  const { page, setPage, pageItems, totalItems, pageSize } = usePagedList(
    ventas ?? [],
    10,
    `${fecha}-${clienteId}-${metodoPago}-${turnoCajaId}`
  );

  const hayFiltros = fecha || clienteId || metodoPago || turnoCajaId;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          type="date"
          className="w-auto"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setTurnoCajaId("");
          }}
        />
        <Select
          value={turnoCajaId || TODOS}
          onValueChange={(v) => {
            setTurnoCajaId(v === TODOS ? "" : v);
            setFecha("");
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos los turnos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los turnos</SelectItem>
            {turnos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {nombreTurno(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clienteId || TODOS} onValueChange={(v) => setClienteId(v === TODOS ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={metodoPago || TODOS} onValueChange={(v) => setMetodoPago(v === TODOS ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los métodos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los métodos</SelectItem>
            {METODOS.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFecha("");
              setClienteId("");
              setMetodoPago("");
              setTurnoCajaId("");
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {loadError && (
        <div className="font-body text-sm text-center py-10 text-destructive">
          {loadError} — <button className="underline" onClick={cargar}>reintentar</button>
        </div>
      )}
      {!loadError && ventas === null && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {!loadError && ventas !== null && ventas.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas que coincidan.</div>
      )}

      {!loadError && ventas && ventas.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setDetalle(v)}>
                  <TableCell className="font-body text-sm font-medium text-foreground">{nombreCliente(v)}</TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">
                    {new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">{v.turnoCaja?.tipoTurno.nombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {v.metodoPago}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(v.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DataPagination page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />

      <VentaDetalleModal venta={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}
