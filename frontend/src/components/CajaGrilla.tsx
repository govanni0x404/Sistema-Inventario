import { Minus, Percent, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moneyCaja as money } from "@/lib/format";

type Linea = {
  id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio: number;
  descuento: number;
  stockMax: number;
  brutoEnCentavos: number;
  descuentoEnCentavos: number;
};

export default function CajaGrilla({ filas, bloqueada, editarDescuento, descuentosActivos, cambiarCantidad, quitar }: {
  filas: Linea[];
  bloqueada: boolean;
  cambiarCantidad: (id: string, delta: number) => void;
  editarDescuento: (id: string) => void;
  descuentosActivos: boolean;
  quitar: (id: string) => void;
}) {
  return (
    <section aria-label="Productos de la venta" tabIndex={0} className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2">
      <table className="w-full min-w-[38rem] text-sm">
        <TableHeader className="sticky top-0 z-10 bg-secondary">
          <TableRow>
            <TableHead className="pl-4">Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Cantidad</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Descuento</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead className="w-12"><span className="sr-only">Quitar producto</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{fila.codigo}</TableCell>
              <TableCell className="min-w-36 font-semibold whitespace-normal">{fila.nombre}
                {fila.cantidad > fila.stockMax && <p className="mt-1 text-xs text-destructive">Solo {fila.stockMax} disponibles.</p>}
              </TableCell>
              <TableCell>
                <div className="mx-auto flex w-fit items-center gap-1 rounded-lg border bg-background p-0.5">
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={bloqueada || fila.cantidad <= 1}
                    aria-label={`Restar una unidad de ${fila.nombre}`} onClick={() => cambiarCantidad(fila.id, -1)}><Minus size={14} /></Button>
                  <span className="min-w-5 text-center text-sm font-semibold tabular-nums">{fila.cantidad}</span>
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={bloqueada || fila.cantidad >= fila.stockMax}
                    aria-label={`Agregar una unidad de ${fila.nombre}`} onClick={() => cambiarCantidad(fila.id, 1)}><Plus size={14} /></Button>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(fila.precio)}</TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="ghost" size="sm" disabled={bloqueada || (!descuentosActivos && !fila.descuento)}
                  aria-label={`Descuento para ${fila.nombre}`} onClick={() => editarDescuento(fila.id)}>
                  <Percent size={14} /> {money(fila.descuento)}
                </Button>
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money((fila.brutoEnCentavos - fila.descuentoEnCentavos) / 100)}</TableCell>
              <TableCell>
                <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground" disabled={bloqueada}
                  aria-label={`Quitar ${fila.nombre}`} onClick={() => quitar(fila.id)}><Trash2 size={15} /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
      {filas.length === 0 && (
        <div className="grid place-items-center gap-2 px-4 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true"><ShoppingCart size={21} /></span>
          <p className="font-display text-base font-semibold">Agrega productos a la venta</p>
          <p className="text-sm text-muted-foreground">Busca por nombre o escanea un código de barras.</p>
        </div>
      )}
    </section>
  );
}
