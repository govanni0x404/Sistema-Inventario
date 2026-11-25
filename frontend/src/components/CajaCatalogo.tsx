import { useMemo, useRef, useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";
import ImagenProducto from "@/components/ImagenProducto";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moneyCaja as money } from "@/lib/format";
import type { Producto } from "@/types/producto";

const TODAS = "todas";
const SIN_FAMILIA = "sin-familia";
const orden = new Intl.Collator("es-CL", { numeric: true, sensitivity: "base" });

function agruparPorFamilia(productos: Producto[]) {
  const grupos = new Map<string, { id: string; nombre: string; productos: Producto[] }>();
  for (const producto of productos) {
    const id = producto.categoria?.id ?? SIN_FAMILIA;
    const grupo = grupos.get(id) ?? { id, nombre: producto.categoria?.nombre ?? "Sin familia", productos: [] };
    grupo.productos.push(producto);
    grupos.set(id, grupo);
  }
  return [...grupos.values()]
    .sort((a, b) => Number(a.id === SIN_FAMILIA) - Number(b.id === SIN_FAMILIA) || orden.compare(a.nombre, b.nombre))
    .map((grupo) => ({
      ...grupo,
      productos: grupo.productos.sort((a, b) => orden.compare(a.nombre, b.nombre) || orden.compare(a.codigoBarras ?? "", b.codigoBarras ?? "")),
    }));
}

export default function CajaCatalogo({ productos, agregar, precio, bloqueado, enfocarBusqueda, permiteSinStock }: {
  productos: Producto[];
  agregar: (producto: Producto) => void;
  precio: (producto: Producto) => number;
  bloqueado: boolean;
  permiteSinStock: boolean;
  enfocarBusqueda: () => void;
}) {
  const [familiaId, setFamiliaId] = useState(TODAS);
  const regresarABusqueda = useRef(false);
  const familias = useMemo(() => agruparPorFamilia(productos), [productos]);
  const familiaSeleccionada = familias.find((familia) => familia.id === familiaId);
  const visibles = familiaSeleccionada ? [familiaSeleccionada] : familias;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 border bg-muted/60 text-primary hover:bg-muted"
          aria-label="Abrir catálogo de productos" title="Catálogo de productos">
          <LayoutGrid size={16} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-4xl lg:max-w-5xl"
        onCloseAutoFocus={(event) => {
          if (!regresarABusqueda.current) return;
          event.preventDefault();
          regresarABusqueda.current = false;
          enfocarBusqueda();
        }}>
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:px-6 sm:pr-12">
          <DialogTitle>Catálogo de productos</DialogTitle>
          <DialogDescription>Elige una familia y selecciona un producto para agregarlo a la venta.</DialogDescription>
        </DialogHeader>
        {familias.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/35 px-4 py-3 sm:px-6">
            <Label htmlFor="caja-familia">Familia</Label>
            <Select value={familiaSeleccionada?.id ?? TODAS} onValueChange={setFamiliaId}>
              <SelectTrigger id="caja-familia" className="w-auto max-w-full min-w-40 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las familias</SelectItem>
                {familias.map((familia) => <SelectItem key={familia.id} value={familia.id}>{familia.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {visibles.length === 0 && <p className="py-7 text-center text-sm text-muted-foreground">Todavía no hay productos activos en el catálogo.</p>}
          {visibles.map((familia) => (
            <section key={familia.id} aria-label={familia.nombre}>
              <h3 className="mb-2.5 break-words font-display font-semibold">{familia.nombre}</h3>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {familia.productos.map((producto) => (
                  <li key={producto.id} className="min-w-0">
                    <DialogClose asChild>
                      <button type="button" disabled={bloqueado || (!permiteSinStock && producto.inventariable !== false && producto.stockCaja <= 0)}
                        onClick={() => {
                          regresarABusqueda.current = true;
                          agregar(producto);
                        }}
                        className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left transition-colors enabled:hover:border-primary enabled:hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-65">
                        <ImagenProducto key={producto.imagenUrl ?? ""} url={producto.imagenUrl} className="aspect-[4/3] w-full" />
                        <span className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">{producto.nombre}</span>
                        {producto.codigoBarras && <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{producto.codigoBarras}</span>}
                        <span className="mt-auto flex flex-wrap items-baseline justify-between gap-1 pt-0.5">
                          {producto.mostrarPrecio !== false && <span className="text-sm font-semibold tabular-nums">{money(precio(producto))}</span>}
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {producto.inventariable === false ? "Sin control de stock"
                              : producto.stockCaja > 0 ? <><Plus size={13} aria-hidden="true" />{producto.stockCaja} disp.</> : "Sin stock"}
                          </span>
                        </span>
                      </button>
                    </DialogClose>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
