import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aCentavos, moneyCaja as money, montoInput, pisoPesosEnteros } from "@/lib/format";

export default function CajaDescuentoDialog({ titulo, base, maximo, actual, cerrar, aplicar }: {
  titulo: string;
  base: number;
  maximo: number;
  actual: number;
  cerrar: () => void;
  aplicar: (centavos: number) => void;
}) {
  const [tipo, setTipo] = useState<"monto" | "porcentaje">("monto");
  const [valor, setValor] = useState(actual ? montoInput(actual / 100) : "");
  const numero = Number(valor);
  // CLP sin centavos: el descuento siempre queda en pesos enteros (el porcentaje se redondea hacia abajo).
  const centavos = tipo === "monto" ? aCentavos(Math.trunc(numero)) : pisoPesosEnteros(Math.floor(base * aCentavos(numero) / 10_000));
  const limite = tipo === "monto" ? Math.floor(maximo / 100) : base > 0 ? Math.floor(maximo / base * 10_000) / 100 : 0;
  const invalido = !Number.isFinite(numero) || numero < 0 || numero > limite || centavos > maximo
    || (tipo === "monto" && !Number.isInteger(numero));

  return (
    <Dialog open onOpenChange={(open) => !open && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Base {money(base / 100)} · Máximo disponible {money(maximo / 100)}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!invalido) aplicar(centavos); }}>
          <Select value={tipo} onValueChange={(value: "monto" | "porcentaje") => { setTipo(value); setValor(""); }}>
            <SelectTrigger aria-label="Tipo de descuento" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="monto">Monto ($)</SelectItem><SelectItem value="porcentaje">Porcentaje (%)</SelectItem></SelectContent>
          </Select>
          <div className="space-y-1.5">
            <Label htmlFor="caja-descuento">{tipo === "monto" ? "Monto del descuento" : "Porcentaje del descuento"}</Label>
            <Input autoFocus id="caja-descuento" type="number" min={0} step={tipo === "monto" ? "1" : "0.01"} inputMode={tipo === "monto" ? "numeric" : "decimal"} value={valor} onChange={(event) => setValor(event.target.value)} placeholder="0" />
            <p className={invalido ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {invalido ? (tipo === "monto" && valor !== "" && !Number.isInteger(numero) ? "Ingresa un monto en pesos enteros, sin decimales." : `El límite disponible es ${tipo === "monto" ? money(limite) : `${limite.toLocaleString("es-CL")} %`}.`) : `Descuento aplicado ${money(centavos / 100)}`}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={invalido}>Aplicar descuento</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
