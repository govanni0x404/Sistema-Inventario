import { memo } from "react";
import { Minus, Percent, Plus, ScanBarcode, ShoppingCart, Trash2 } from "lucide-react";
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

function CajaGrilla({ filas, bloqueada, editarDescuento, descuentosActivos, cambiarCantidad, quitar }: {
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
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--color-border)] [&_th]:text-[0.7rem] [&_th]:font-semibold [&_th]:tracking-wider [&_th]:uppercase">
          <TableRow className="border-0 bg-muted/60 hover:bg-muted/60">
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
            <TableRow key={fila.id} className="hover:bg-primary/5">
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
              <TableCell className="money text-right tabular-nums">{money(fila.precio)}</TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="ghost" size="sm" disabled={bloqueada || (!descuentosActivos && !fila.descuento)}
                  aria-label={`Descuento para ${fila.nombre}`} onClick={() => editarDescuento(fila.id)}>
                  <Percent size={14} /> <span className={fila.descuento > 0 ? "money text-success" : "money"}>{fila.descuento > 0 ? `−${money(fila.descuento)}` : money(0)}</span>
                </Button>
              </TableCell>
              <TableCell className="money text-right font-semibold tabular-nums">{money((fila.brutoEnCentavos - fila.descuentoEnCentavos) / 100)}</TableCell>
              <TableCell>
                <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={bloqueada}
                  aria-label={`Quitar ${fila.nombre}`} onClick={() => quitar(fila.id)}><Trash2 size={15} /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
      {filas.length === 0 && (
        <div className="grid place-items-center gap-3 px-4 py-14 text-center">
          <span className="relative grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5" aria-hidden="true">
            <ShoppingCart size={28} />
            <span className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-lg border bg-card text-muted-foreground shadow-sm"><ScanBarcode size={15} /></span>
          </span>
          <p className="mt-1 font-display text-lg font-semibold">El carrito está vacío</p>
          <p className="max-w-xs text-sm text-muted-foreground">Busca un producto por nombre, escanea su código de barras o ábrelo desde el catálogo para agregarlo a la venta.</p>
        </div>
      )}
    </section>
  );
}

export default memo(CajaGrilla);
