import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export type RangoPreset = "1" | "7" | "30" | "90" | "custom";

const RANGO_LABEL: Record<RangoPreset, string> = {
  "1": "Hoy",
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  custom: "Personalizado",
};

export default function RangoFechasSelector({
  rango,
  setRango,
  desdeCustom,
  setDesdeCustom,
  hastaCustom,
  setHastaCustom,
}: {
  rango: RangoPreset;
  setRango: (r: RangoPreset) => void;
  desdeCustom: string;
  setDesdeCustom: (v: string) => void;
  hastaCustom: string;
  setHastaCustom: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={rango} onValueChange={(v) => setRango(v as RangoPreset)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(RANGO_LABEL) as RangoPreset[]).map((r) => (
            <SelectItem key={r} value={r}>
              {RANGO_LABEL[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {rango === "custom" && (
        <>
          <Input type="date" className="w-auto" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} />
          <span className="font-body text-xs text-muted-foreground">a</span>
          <Input type="date" className="w-auto" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} />
        </>
      )}
    </div>
  );
}
