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
    <Card className="py-0">
      <CardContent className="p-4 flex items-start gap-3">
        <span
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
            tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-body text-xs text-muted-foreground truncate">{label}</div>
          <div className="font-sans text-xl font-semibold text-foreground leading-tight mt-0.5">{value}</div>
          {sublabel && <div className="font-body text-xs text-muted-foreground mt-0.5">{sublabel}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
