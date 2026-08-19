import { useState } from "react";
import { cn } from "@/lib/utils";

type Item = { key: string; label: string; value: number; sublabel?: string };

export default function MagnitudeBarChart({
  items,
  formatValue,
  emptyLabel = "Sin datos en este período.",
}: {
  items: Item[];
  formatValue: (n: number) => string;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return <div className="font-body text-sm text-center py-8 text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, 2);
        const isHovered = hovered === item.key;
        return (
          <div
            key={item.key}
            className="group"
            onPointerEnter={() => setHovered(item.key)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.key)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            role="img"
            aria-label={`${item.label}: ${formatValue(item.value)}`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="font-body text-xs text-foreground truncate capitalize">{item.label}</span>
              <span className="font-mono text-xs font-medium text-foreground shrink-0">{formatValue(item.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-primary transition-[width,opacity]", isHovered ? "opacity-100" : "opacity-90")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sublabel && <div className="font-body text-[11px] text-muted-foreground mt-0.5">{item.sublabel}</div>}
          </div>
        );
      })}
    </div>
  );
}
