import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CajaCatalogo from "@/components/CajaCatalogo";
import { moneyCaja as money } from "@/lib/format";
import type { Producto } from "@/types/producto";

const claveFavoritos = "inventario_caja_favoritos";

function leerFavoritos(): string[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(claveFavoritos) ?? "[]");
    return Array.isArray(datos) ? datos.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function CajaBusqueda({ productos, resultados, texto, alBuscar, alTecla, agregar, precio, bloqueado, permiteSinStock }: {
  productos: Producto[];
  resultados: Producto[];
  texto: string;
  alBuscar: (q: string) => void;
  alTecla: (e: KeyboardEvent<HTMLInputElement>) => void;
  agregar: (p: Producto) => void;
  precio: (p: Producto) => number;
  bloqueado: boolean;
  permiteSinStock: boolean;
}) {
  const [favoritos, setFavoritos] = useState(() => new Set(leerFavoritos()));
  const [verFavoritos, setVerFavoritos] = useState(false);
  const campoBusqueda = useRef<HTMLInputElement>(null);
  const volverABusqueda = useRef(false);
  const [resaltado, setResaltado] = useState(-1);
  const listaId = useId();
  const destacados = useMemo(() => productos.filter((p) => favoritos.has(p.id)), [productos, favoritos]);
  const disponible = (p: Producto) => permiteSinStock || p.inventariable === false || p.stockCaja > 0;
  const habilitados = resultados.filter(disponible);
  const seleccionado = habilitados[resaltado];
  const abierto = !!texto.trim();
  const opcionId = (p: Producto) => `${listaId}-${p.id}`;

  const alternarFavorito = (id: string) => {
    const siguientes = new Set(favoritos);
    if (siguientes.has(id)) siguientes.delete(id); else siguientes.add(id);
    setFavoritos(siguientes);
    try { localStorage.setItem(claveFavoritos, JSON.stringify([...siguientes])); } catch { /* Sigue disponible durante esta sesión. */ }
  };

  const contenidoProducto = (p: Producto) => (
    <>
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs text-muted-foreground">{p.codigoBarras || "Sin código"}</span>
        <span className="block truncate text-sm font-semibold">{p.nombre}</span>
        {p.inventariable !== false && <span className={cn("block truncate text-xs", p.stockCaja > 0 ? "text-muted-foreground" : "text-destructive")}>{p.stockCaja > 0 ? `${p.stockCaja} disp.` : "Sin stock"}</span>}
      </span>
      {p.mostrarPrecio !== false && <span className="money shrink-0 text-sm font-semibold tabular-nums">{money(precio(p))}</span>}
    </>
  );

  const botonFavorito = (p: Producto): ReactNode => {
    const favorito = favoritos.has(p.id);
    return (
      <Button type="button" variant="ghost" size="icon" aria-label={`${favorito ? "Quitar de favoritos" : "Guardar en favoritos"}: ${p.nombre}`}
        aria-pressed={favorito} onMouseDown={(e) => e.preventDefault()} onClick={() => alternarFavorito(p.id)}>
        <Star size={16} className={favorito ? "fill-warning text-warning" : "text-muted-foreground"} />
      </Button>
    );
  };

  // Resultados de búsqueda: patrón combobox/listbox. El foco se queda en el campo y la opción activa
  // se anuncia con aria-activedescendant.
  const listaResultados = (
    <ul id={listaId} role="listbox" aria-label="Resultados de la búsqueda" className="max-h-72 divide-y overflow-y-auto">
      {resultados.map((p) => {
        const deshabilitado = bloqueado || !disponible(p);
        const activo = seleccionado?.id === p.id;
        return (
          <li key={p.id} role="presentation" className="flex items-center gap-1 p-1">
            <div id={opcionId(p)} role="option" aria-selected={activo} aria-disabled={deshabilitado} data-resaltado={activo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (deshabilitado) return;
                agregar(p);
                setResaltado(-1);
                campoBusqueda.current?.focus();
              }}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-primary/5 data-[resaltado=true]:bg-accent data-[resaltado=true]:text-accent-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
              {contenidoProducto(p)}
            </div>
            {botonFavorito(p)}
          </li>
        );
      })}
    </ul>
  );

  const listaFavoritos = (
    <ul className="max-h-72 divide-y overflow-y-auto">
      {destacados.map((p) => (
        <li key={p.id} className="flex items-center gap-1 p-1">
          <button type="button" disabled={bloqueado || !disponible(p)} onClick={() => {
            agregar(p);
            setResaltado(-1);
            volverABusqueda.current = true;
            setVerFavoritos(false);
          }} className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-primary/5 disabled:opacity-50">
            {contenidoProducto(p)}
          </button>
          {botonFavorito(p)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="group relative min-w-44 flex-1">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="caja-buscador" ref={campoBusqueda} autoFocus aria-label="Buscar producto por nombre o código de barras" autoComplete="off"
          role="combobox" aria-autocomplete="list" aria-expanded={abierto && resultados.length > 0} aria-controls={listaId}
          aria-activedescendant={seleccionado ? opcionId(seleccionado) : undefined}
          aria-describedby="caja-busqueda-teclado" placeholder="Buscar producto o código de barras…" className="h-11 bg-card pr-12 pl-10"
          value={texto} onChange={(e) => { setResaltado(-1); alBuscar(e.target.value); }} onKeyDown={(e) => {
            if (e.key === "Escape") { setResaltado(-1); alBuscar(""); }
            else if (!bloqueado && habilitados.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              const siguiente = e.key === "ArrowDown" ? (resaltado + 1) % habilitados.length : resaltado <= 0 ? habilitados.length - 1 : resaltado - 1;
              setResaltado(siguiente);
              document.getElementById(opcionId(habilitados[siguiente]))?.scrollIntoView({ block: "nearest" });
            } else if (!bloqueado && e.key === "Enter" && seleccionado) {
              e.preventDefault();
              agregar(seleccionado);
              setResaltado(-1);
            } else alTecla(e);
          }} />
        <span id="caja-busqueda-teclado" className="sr-only">Usa las flechas para recorrer los resultados y Enter para agregar el producto.</span>
        <CajaCatalogo productos={productos} agregar={agregar} precio={precio} bloqueado={bloqueado} permiteSinStock={permiteSinStock}
          enfocarBusqueda={() => campoBusqueda.current?.focus()} />
        {abierto && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 hidden overflow-hidden rounded-xl border bg-card shadow-lg group-focus-within:block">
            {resultados.length ? listaResultados : <p role="status" className="p-4 text-sm text-muted-foreground">Sin resultados.</p>}
          </div>
        )}
      </div>
      <Popover open={verFavoritos} onOpenChange={setVerFavoritos}>
        <PopoverTrigger asChild><Button type="button" variant="outline" className="h-11"><Star size={16} className="text-warning" /> Favoritos</Button></PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-2" aria-label="Productos favoritos"
          onCloseAutoFocus={(event) => {
            if (!volverABusqueda.current) return;
            event.preventDefault();
            volverABusqueda.current = false;
            campoBusqueda.current?.focus();
          }}>
          {destacados.length ? listaFavoritos : <p className="p-3 text-sm text-muted-foreground">Pulsa la estrella junto a un resultado de búsqueda para guardarlo aquí.</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
