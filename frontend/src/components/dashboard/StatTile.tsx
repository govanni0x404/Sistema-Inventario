import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatTile({
  label,
  value,
  sublabel,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-3.5 sm:p-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-snug font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-display text-[clamp(1rem,2vw,1.6rem)] leading-tight font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]">{value}</p>
          {sublabel && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
