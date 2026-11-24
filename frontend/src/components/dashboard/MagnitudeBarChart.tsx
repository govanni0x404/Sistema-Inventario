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
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  if (items.length === 0) {
    return <div className="font-body text-sm text-center py-8 text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.abs(item.value) / max * 100;
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs text-foreground capitalize [overflow-wrap:anywhere]">{item.label}</span>
              <span className="font-mono text-xs font-medium text-foreground shrink-0">{formatValue(item.value)}</span>
            </div>
            <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", item.value < 0 ? "bg-destructive" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sublabel && <div className="font-body text-[11px] text-muted-foreground mt-0.5">{item.sublabel}</div>}
          </li>
        );
      })}
    </ul>
  );
}
