import { useId, useState } from "react";
import type { PointerEvent } from "react";
import { fechaCompleta, fechaCorta } from "@/lib/fechas";
import { LOCALE, money } from "@/lib/format";

type Point = { fecha: string; total: number; cantidad: number };
const W = 1_000;
const H = 200;
const axis = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

function niceMax(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const factor = [1, 2, 2.5, 5, 10].find((step) => value <= step * magnitude) ?? 10;
  return factor * magnitude;
}

export default function SalesLineChart({ data, metric }: { data: Point[]; metric: "total" | "cantidad" }) {
  const gradientId = useId();
  const rangeId = useId();
  const [active, setActive] = useState(data.length - 1);
  const point = data[active];
  const peak = Math.max(4, ...data.map((p) => p[metric]));
  const max = metric === "cantidad" ? Math.ceil(peak / 4) * 4 : niceMax(peak);
  const xFor = (index: number) => data.length < 2 ? W / 2 : (index / (data.length - 1)) * W;
  const yFor = (value: number) => H - (value / max) * H;
  const values = data.map((p, i) => `${xFor(i)},${yFor(p[metric])}`).join(" ");
  const area = `${xFor(0)},${H} ${values} ${xFor(data.length - 1)},${H}`;

  const chooseDay = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActive(Math.round(percent * (data.length - 1)));
  };

  if (data.length === 0 || !data.some((p) => p.total || p.cantidad)) {
    return <p className="mt-5 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Aún no hay ventas en este período.</p>;
  }

  return (
    <div className="mt-4">
      {point && (
        <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/60 px-3 py-2 text-xs">
          <time dateTime={point.fecha} className="mr-auto text-muted-foreground">{fechaCompleta(point.fecha)}</time>
          <span className="font-display text-base font-semibold tabular-nums">{money(point.total)}</span>
          <span className="text-muted-foreground">{point.cantidad} {point.cantidad === 1 ? "venta" : "ventas"}</span>
        </div>
      )}
      <div aria-hidden="true" className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-stretch gap-x-2 px-0.5">
        <div className="relative flex flex-col justify-between text-right font-mono text-[10px] leading-none text-muted-foreground">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span key={fraction} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - fraction) * 100}%` }}>
              {axis.format(max * fraction)}
            </span>
          ))}
        </div>
        <div className="relative h-38 touch-pan-y sm:h-44" onPointerDown={chooseDay} onPointerMove={chooseDay}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="var(--primary)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((tick) => (
              <line key={tick} x1={0} x2={W} y1={H * tick / 4} y2={H * tick / 4} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            ))}
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline points={values} fill="none" stroke="var(--primary)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {point && (
              <line x1={xFor(active)} x2={xFor(active)} y1={0} y2={H} stroke="var(--primary)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {point && (
            <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
              style={{ left: `${xFor(active) / W * 100}%`, top: `${yFor(point[metric]) / H * 100}%` }}
            />
          )}
        </div>
        <div className="col-start-2 mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{fechaCorta(data[0].fecha)}</span>
          {data.length > 1 && <span>{fechaCorta(data[data.length - 1].fecha)}</span>}
        </div>
      </div>
      {data.length > 1 && point && (
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor={rangeId} className="text-xs text-muted-foreground">Explorar por día</label>
          <input
            id={rangeId}
            type="range"
            min={0}
            max={data.length - 1}
            value={active}
            onChange={(event) => setActive(Number(event.target.value))}
            aria-valuetext={`${fechaCompleta(point.fecha)}: ${money(point.total)}, ${point.cantidad} ventas`}
            className="h-8 min-w-0 flex-1 accent-primary"
          />
        </div>
      )}
    </div>
  );
}
