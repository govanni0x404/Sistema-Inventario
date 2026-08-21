import { useEffect, useState } from "react";
import { toast } from "sonner";
import { consultasApi } from "../api/consultas";
import type { ProductoTop, VentasPorMetodoItem, VentasPorUsuarioItem } from "../types/consulta";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import RangoFechasSelector from "../components/RangoFechasSelector";
import type { RangoPreset } from "../components/RangoFechasSelector";
import HistorialPage from "./HistorialPage";
import TurnosPage from "./TurnosPage";

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useRango() {
  const [rango, setRango] = useState<RangoPreset>("30");
  const [desdeCustom, setDesdeCustom] = useState(hoyStr());
  const [hastaCustom, setHastaCustom] = useState(hoyStr());
  const params = rango === "custom" ? { desde: desdeCustom, hasta: hastaCustom } : { dias: Number(rango) };
  return { rango, setRango, desdeCustom, setDesdeCustom, hastaCustom, setHastaCustom, params };
}

function ProductosTopReport() {
  const r = useRango();
  const [productos, setProductos] = useState<ProductoTop[] | null>(null);

  useEffect(() => {
    setProductos(null);
    consultasApi
      .productosTop(r.params, 30)
      .then((res) => setProductos(res.productos))
      .catch(() => toast.error("No se pudo cargar el reporte"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.rango, r.desdeCustom, r.hastaCustom]);

  return (
    <div className="space-y-4">
      <RangoFechasSelector {...r} />
      {productos === null && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {productos && productos.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {productos && productos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Monto vendido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.productoId}>
                  <TableCell>
                    <div className="font-body text-sm font-medium text-foreground">{p.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{p.cantidad}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(p.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function VentasPorUsuarioReport() {
  const r = useRango();
  const [usuarios, setUsuarios] = useState<VentasPorUsuarioItem[] | null>(null);

  useEffect(() => {
    setUsuarios(null);
    consultasApi
      .ventasPorUsuario(r.params)
      .then((res) => setUsuarios(res.usuarios))
      .catch(() => toast.error("No se pudo cargar el reporte"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.rango, r.desdeCustom, r.hastaCustom]);

  return (
    <div className="space-y-4">
      <RangoFechasSelector {...r} />
      {usuarios === null && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {usuarios && usuarios.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {usuarios && usuarios.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Cortesías</TableHead>
                <TableHead className="text-right">Total vendido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.usuarioId ?? "sin-usuario"}>
                  <TableCell className="font-body text-sm font-medium text-foreground">{u.nombre}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{u.cantidadVentas}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{u.cantidadCortesias || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(u.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function VentasPorMetodoReport() {
  const r = useRango();
  const [metodos, setMetodos] = useState<VentasPorMetodoItem[] | null>(null);

  useEffect(() => {
    setMetodos(null);
    consultasApi
      .ventasPorMetodo(r.params)
      .then((res) => setMetodos(res.metodos))
      .catch(() => toast.error("No se pudo cargar el reporte"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.rango, r.desdeCustom, r.hastaCustom]);

  return (
    <div className="space-y-4">
      <RangoFechasSelector {...r} />
      {metodos === null && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {metodos && metodos.length === 0 && (
        <div className="font-body text-sm text-center py-10 text-muted-foreground">No hay ventas en este periodo.</div>
      )}
      {metodos && metodos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método de pago</TableHead>
                <TableHead className="text-right">Cantidad de pagos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metodos.map((m) => (
                <TableRow key={m.metodoPago}>
                  <TableCell className="font-body text-sm font-medium text-foreground capitalize">{m.metodoPago}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{m.cantidad}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(m.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function ConsultasPage() {
  return (
    <Tabs defaultValue="detalle-venta">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="detalle-venta">Detalle de venta</TabsTrigger>
        <TabsTrigger value="productos-top">Productos más vendidos</TabsTrigger>
        <TabsTrigger value="turnos">Cierre de turnos</TabsTrigger>
        <TabsTrigger value="por-usuario">Ventas por usuario</TabsTrigger>
        <TabsTrigger value="por-metodo">Ventas por forma de pago</TabsTrigger>
      </TabsList>

      <TabsContent value="detalle-venta">
        <HistorialPage />
      </TabsContent>
      <TabsContent value="productos-top">
        <ProductosTopReport />
      </TabsContent>
      <TabsContent value="turnos">
        <TurnosPage />
      </TabsContent>
      <TabsContent value="por-usuario">
        <VentasPorUsuarioReport />
      </TabsContent>
      <TabsContent value="por-metodo">
        <VentasPorMetodoReport />
      </TabsContent>
    </Tabs>
  );
}
