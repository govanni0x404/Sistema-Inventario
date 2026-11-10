import { useId, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { LOCALE, money } from "../../lib/format";

type Point = { fecha: string; total: number; cantidad: number };

const W = 600;
const H = 220;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;


function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return step * magnitude;
}

export default function SalesLineChart({ data }: { data: Point[] }) {
  const clipId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const maxVal = useMemo(() => niceMax(Math.max(...data.map((d) => d.total), 1)), [data]);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xFor = (i: number) => PAD_L + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) => PAD_T + innerH - (v / maxVal) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.total)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${PAD_T + innerH} L ${xFor(0)} ${PAD_T + innerH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setActive(nearest);
  };

  const activePoint = active !== null ? data[active] : null;
  const formatDia = (fecha: string) =>
    new Date(`${fecha}T00:00:00`).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });

  return (
    <div ref={containerRef} className="relative w-full" onPointerLeave={() => setActive(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Ventas de los últimos días"
        onPointerMove={handlePointerMove}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_L - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground" fontSize={10}>
              {t >= 1000 ? `${Math.round(t / 1000)}K` : t}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--primary)" opacity={0.1} clipPath={`url(#${clipId})`} />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) =>
          i % Math.ceil(data.length / 7) === 0 ? (
            <text key={d.fecha} x={xFor(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {formatDia(d.fecha)}
            </text>
          ) : null
        )}

        {active !== null && (
          <line x1={xFor(active)} x2={xFor(active)} y1={PAD_T} y2={PAD_T + innerH} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 2" />
        )}

        {data.map((d, i) => (
          <circle
            key={d.fecha}
            cx={xFor(i)}
            cy={yFor(d.total)}
            r={active === i ? 4 : 0}
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        ))}

        {data.map((d, i) => (
          <rect
            key={`hit-${d.fecha}`}
            x={xFor(i) - innerW / data.length / 2}
            y={PAD_T}
            width={innerW / data.length}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${formatDia(d.fecha)}: ${money(d.total)}`}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="outline-none focus-visible:fill-primary/5"
          />
        ))}
      </svg>

      {activePoint && (
        <div
          className="absolute top-2 pointer-events-none rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs font-body"
          style={{
            left: `${(xFor(active!) / W) * 100}%`,
            transform: active! > data.length / 2 ? "translateX(-105%)" : "translateX(5%)",
          }}
        >
          <div className="text-muted-foreground">{formatDia(activePoint.fecha)}</div>
          <div className="font-semibold text-foreground">{money(activePoint.total)}</div>
          <div className="text-muted-foreground">{activePoint.cantidad} venta{activePoint.cantidad !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}
