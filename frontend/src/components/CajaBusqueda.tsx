import { useRef, useState, type KeyboardEvent } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CajaCatalogo from "@/components/CajaCatalogo";
import { money } from "@/lib/format";
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

export default function CajaBusqueda({ productos, resultados, texto, alBuscar, alTecla, agregar, precio, bloqueado }: {
  productos: Producto[];
  resultados: Producto[];
  texto: string;
  alBuscar: (q: string) => void;
  alTecla: (e: KeyboardEvent<HTMLInputElement>) => void;
  agregar: (p: Producto) => void;
  precio: (p: Producto) => number;
  bloqueado: boolean;
}) {
  const [favoritos, setFavoritos] = useState(leerFavoritos);
  const [verFavoritos, setVerFavoritos] = useState(false);
  const campoBusqueda = useRef<HTMLInputElement>(null);
  const volverABusqueda = useRef(false);
  const destacados = productos.filter((p) => favoritos.includes(p.id));

  const alternarFavorito = (id: string) => {
    const siguientes = favoritos.includes(id) ? favoritos.filter((valor) => valor !== id) : [...favoritos, id];
    setFavoritos(siguientes);
    try { localStorage.setItem(claveFavoritos, JSON.stringify(siguientes)); } catch { /* Sigue disponible durante esta sesión. */ }
  };

  const mostrarProductos = (items: Producto[], desdeFavoritos = false) => (
    <ul className="max-h-72 divide-y overflow-y-auto">
      {items.map((p) => {
        const favorito = favoritos.includes(p.id);
        return (
          <li key={p.id} className="flex items-center gap-1 p-1">
            <button type="button" disabled={bloqueado || (p.inventariable !== false && p.stockCaja <= 0)} onClick={() => {
              agregar(p);
              if (desdeFavoritos) {
                volverABusqueda.current = true;
                setVerFavoritos(false);
              } else {
                campoBusqueda.current?.focus();
              }
            }} className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.codigoBarras || p.sku}{p.inventariable !== false && ` · ${p.stockCaja} disp.`}</span>
              </span>
              {p.mostrarPrecio !== false && <span className="shrink-0 text-sm font-semibold tabular-nums">{money(precio(p))}</span>}
            </button>
            <Button type="button" variant="ghost" size="icon" aria-label={`${favorito ? "Quitar de favoritos" : "Guardar en favoritos"}: ${p.nombre}`}
              aria-pressed={favorito} onClick={() => alternarFavorito(p.id)}>
              <Star size={16} className={favorito ? "fill-amber-400 text-amber-500" : "text-muted-foreground"} />
            </Button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="group relative min-w-44 flex-1">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input ref={campoBusqueda} autoFocus aria-label="Buscar producto por nombre, SKU o código de barras" autoComplete="off"
          placeholder="Buscar producto, SKU o código de barras…" className="h-11 bg-card pr-12 pl-10"
          value={texto} onChange={(e) => alBuscar(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Escape") alBuscar("");
            else alTecla(e);
          }} />
        <CajaCatalogo productos={productos} agregar={agregar} precio={precio} bloqueado={bloqueado}
          enfocarBusqueda={() => campoBusqueda.current?.focus()} />
        {texto.trim() && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 hidden rounded-xl border bg-card shadow-lg group-focus-within:block">
            {resultados.length ? mostrarProductos(resultados) : <p role="status" className="p-4 text-sm text-muted-foreground">Sin resultados.</p>}
          </div>
        )}
      </div>
      <Popover open={verFavoritos} onOpenChange={setVerFavoritos}>
        <PopoverTrigger asChild><Button type="button" variant="outline" className="h-11"><Star size={16} /> Favoritos</Button></PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-2" aria-label="Productos favoritos"
          onCloseAutoFocus={(event) => {
            if (!volverABusqueda.current) return;
            event.preventDefault();
            volverABusqueda.current = false;
            campoBusqueda.current?.focus();
          }}>
          {destacados.length ? mostrarProductos(destacados, true) : <p className="p-3 text-sm text-muted-foreground">Pulsa la estrella junto a un resultado de búsqueda para guardarlo aquí.</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
