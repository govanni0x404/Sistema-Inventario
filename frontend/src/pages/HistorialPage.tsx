import { useEffect, useState } from "react";
import { ventasApi } from "../api/ventas";
import { clientesApi } from "../api/clientes";
import { ApiError } from "../api/client";
import type { Venta, MetodoPago } from "../types/venta";
import type { Cliente } from "../types/cliente";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import VentaDetalleModal from "../components/VentaDetalleModal";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];
const TODOS = "__todos__";

export default function HistorialPage() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [fecha, setFecha] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("");

  const cargar = async () => {
    try {
      setLoadError(null);
      const [v, c] = await Promise.all([
        ventasApi.listar({ fecha: fecha || undefined, clienteId: clienteId || undefined, metodoPago: metodoPago || undefined }),
        clientesApi.listar(),
      ]);
      setVentas(v);
      setClientes(c);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "No se pudo conectar con el servidor");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, clienteId, metodoPago]);

  const nombreCliente = (v: Venta) => v.cliente?.nombre || "Cliente general";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input type="date" className="w-auto" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
        {(fecha || clienteId || metodoPago) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFecha("");
              setClienteId("");
              setMetodoPago("");
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
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setDetalle(v)}>
                  <TableCell className="font-body text-sm font-medium text-foreground">{nombreCliente(v)}</TableCell>
                  <TableCell className="font-body text-xs text-muted-foreground">
                    {new Date(v.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
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

      <VentaDetalleModal venta={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}
