import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { navItems, tieneAcceso } from "./nav-data";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { matchesSearch, normalizeSearch } from "@/lib/search";

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const term = normalizeSearch(q);
  const resultados = navItems.filter((item) => tieneAcceso(usuario, item) && matchesSearch(term, [item.label, item.group, item.to]));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const setOpen = (next: boolean) => {
    if (!next) {
      setQ("");
      setActiveIndex(0);
    }
    onOpenChange(next);
  };

  const ir = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, Math.min(i + 1, resultados.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = resultados[activeIndex];
      if (item) ir(item.to);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setQ("");
          setActiveIndex(0);
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Buscar sección</DialogTitle>
        <DialogDescription className="sr-only">Usa las flechas para elegir una sección y pulsa Enter para abrirla.</DialogDescription>
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Buscar sección"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={resultados[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ir a una sección…"
            className="min-w-0 flex-1 bg-transparent py-4 pr-7 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {resultados.length === 0 && <p role="status" className="p-5 text-center text-sm text-muted-foreground">Sin resultados.</p>}
        <div id={listId} role="listbox" aria-label="Secciones" className="max-h-[min(22rem,58dvh)] overflow-y-auto p-1.5">
          {resultados.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.to}
                id={`${listId}-${i}`}
                ref={i === activeIndex ? activeRef : null}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => ir(item.to)}
                onPointerMove={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <Icon size={15} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.group !== "General" && <span className="text-[11px] text-muted-foreground">{item.group}</span>}
                <ArrowUpRight size={13} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
