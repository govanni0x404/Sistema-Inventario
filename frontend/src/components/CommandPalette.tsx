import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { navGroups, adminNavItems, categoriasNavItem } from "./nav-data";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const base = navGroups.flatMap((g) => g.items);
    const permitidos = base.filter((item) => usuario?.rol === "admin" || usuario?.permisos?.[item.seccion] !== false);
    return usuario?.rol === "admin" ? [...permitidos, categoriasNavItem, ...adminNavItems] : permitidos;
  }, [usuario]);

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.label.toLowerCase().includes(term));
  }, [items, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  const ir = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, resultados.length - 1));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md top-[20%] translate-y-0 p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <DialogDescription className="sr-only">Navega rápido a cualquier sección</DialogDescription>
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ir a una sección..."
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground font-body"
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {resultados.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground font-body">Sin resultados.</div>
          )}
          {resultados.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                onClick={() => ir(item.to)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-body cursor-pointer transition-colors",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <Icon size={15} className="shrink-0 text-muted-foreground" />
                {item.label}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
