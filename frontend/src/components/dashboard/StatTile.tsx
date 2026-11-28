import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "info";

const tones: Record<Tone, { icon: string; stripe: string }> = {
  primary: { icon: "bg-primary/12 text-primary ring-primary/20", stripe: "before:bg-primary" },
  success: { icon: "bg-success/12 text-success ring-success/20", stripe: "before:bg-success" },
  warning: { icon: "bg-warning/14 text-warning ring-warning/25", stripe: "before:bg-warning" },
  info: { icon: "bg-info/12 text-info ring-info/20", stripe: "before:bg-info" },
};

export default function StatTile({
  label,
  value,
  sublabel,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  const t = tones[tone];
  return (
    <Card
      className={cn(
        "relative min-w-0 overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        t.stripe,
      )}
    >
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="pt-1 text-xs leading-snug font-semibold text-muted-foreground">{label}</p>
          <span
            aria-hidden="true"
            className={cn("grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset", t.icon)}
          >
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="money text-[clamp(1.1rem,2vw,1.7rem)] leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">{value}</p>
          {sublabel && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
