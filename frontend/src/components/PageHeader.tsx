import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span
            aria-hidden="true"
            className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_16px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)]"
          >
            <Icon size={20} strokeWidth={2.1} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] leading-none font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
          )}
          <h1 className={cn("font-display text-2xl leading-tight font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl", eyebrow && "mt-1")}>
            {title}
          </h1>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
