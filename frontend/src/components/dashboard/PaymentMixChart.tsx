import { LOCALE, money } from "@/lib/format";
import { ETIQUETAS_PAGO, type MetodoPago } from "@/types/venta";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 });

export default function PaymentMixChart({ payments }: { payments: { metodoPago: string; total: number }[] }) {
  const items = payments.filter(({ total }) => total > 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const segments = items.map((item, index) => {
    const share = item.total / total;
    const color = colors[index % colors.length];
    return { ...item, share, color };
  });

  if (!segments.length) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No hay pagos registrados en este período.</p>;
  }

  const slices: string[] = [];
  let start = 0;
  for (const { color, share } of segments) {
    const end = start + share * 100;
    slices.push(`${color} ${start}% ${end}%`);
    start = end;
  }

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[8.5rem_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[8.5rem_minmax(0,1fr)]">
      <div
        aria-hidden="true"
        className="mx-auto grid size-32 place-items-center rounded-full shadow-card"
        style={{ background: `conic-gradient(${slices.join(", ")})` }}
      >
        <div className="grid size-24 place-content-center rounded-full bg-card px-2 text-center [overflow-wrap:anywhere]">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="money text-xs font-bold">{money(total)}</span>
        </div>
      </div>
      <div>
        <p className="sr-only">Total de pagos {money(total)}</p>
        <ul className="divide-y">
          {segments.map(({ metodoPago, total: amount, share, color }) => (
            <li key={metodoPago} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {ETIQUETAS_PAGO[metodoPago as MetodoPago] ?? metodoPago}
              </span>
              <span className="ml-auto shrink-0 text-right font-medium tabular-nums">
                {money(amount)} <span className="ml-1 text-xs text-muted-foreground">{percent.format(share)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
