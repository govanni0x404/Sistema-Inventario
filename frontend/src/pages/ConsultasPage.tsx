import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { consultasApi } from "../api/consultas";
import type { ProductoTop, ProductoMargen, VentasPorMetodoItem, VentasPorUsuarioItem } from "../types/consulta";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import RangoFechasSelector from "../components/RangoFechasSelector";
import type { RangoPreset } from "../components/RangoFechasSelector";
import { exportarCsv } from "../lib/exportCsv";
import MagnitudeBarChart from "../components/dashboard/MagnitudeBarChart";
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

  const exportar = () => {
    if (!productos || productos.length === 0) return;
    exportarCsv(
      `productos-mas-vendidos-${hoyStr()}.csv`,
      productos.map((p) => ({ Producto: p.nombre, SKU: p.sku, Unidades: p.cantidad, "Monto vendido": p.subtotal }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!productos || productos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
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

  const exportar = () => {
    if (!usuarios || usuarios.length === 0) return;
    exportarCsv(
      `ventas-por-usuario-${hoyStr()}.csv`,
      usuarios.map((u) => ({
        Usuario: u.nombre,
        Ventas: u.cantidadVentas,
        Cortesías: u.cantidadCortesias,
        "Total vendido": u.total,
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!usuarios || usuarios.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
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

  const exportar = () => {
    if (!metodos || metodos.length === 0) return;
    exportarCsv(
      `ventas-por-metodo-${hoyStr()}.csv`,
      metodos.map((m) => ({ "Método de pago": m.metodoPago, "Cantidad de pagos": m.cantidad, Total: m.total }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!metodos || metodos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
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

function ProductosMargenReport() {
  const r = useRango();
  const [productos, setProductos] = useState<ProductoMargen[] | null>(null);

  useEffect(() => {
    setProductos(null);
    consultasApi
      .productosMargen(r.params, 20)
      .then((res) => setProductos(res.productos))
      .catch(() => toast.error("No se pudo cargar el reporte"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.rango, r.desdeCustom, r.hastaCustom]);

  const exportar = () => {
    if (!productos || productos.length === 0) return;
    exportarCsv(
      `margen-por-producto-${hoyStr()}.csv`,
      productos.map((p) => ({
        Producto: p.nombre,
        SKU: p.sku,
        Unidades: p.cantidad,
        Ingreso: p.ingreso,
        Costo: p.costo,
        Margen: p.margen,
        "Margen %": p.margenPct.toFixed(1),
      }))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RangoFechasSelector {...r} />
        <Button variant="outline" size="sm" onClick={exportar} disabled={!productos || productos.length === 0} className="ml-auto">
          <Download size={14} /> Exportar CSV
        </Button>
      </div>
      <p className="font-body text-xs text-muted-foreground">
        El costo usa el precio de compra actual de cada producto, no el vigente al momento de cada venta.
      </p>
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
        <>
          <MagnitudeBarChart
            items={productos.map((p) => ({
              key: p.productoId,
              label: p.nombre,
              value: p.margen,
              sublabel: `Ingreso ${money(p.ingreso)} · Costo ${money(p.costo)} · Margen ${p.margenPct.toFixed(1)}%`,
            }))}
            formatValue={money}
          />
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
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
                    <TableCell className="text-right font-mono text-sm text-foreground">{money(p.ingreso)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{money(p.costo)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-primary">{money(p.margen)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">{p.margenPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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
        <TabsTrigger value="margenes">Márgenes por producto</TabsTrigger>
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
      <TabsContent value="margenes">
        <ProductosMargenReport />
      </TabsContent>
    </Tabs>
  );
}
