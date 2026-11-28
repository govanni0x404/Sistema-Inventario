import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { PackageX, Percent, Receipt, Rows3, Settings2, Store } from "lucide-react";
import { negocioApi } from "../api/negocio";
import { ApiError } from "../api/client";
import { useNegocio } from "../context/NegocioContext";
import { formatearRut, rutValido } from "../lib/rut";
import { DOCUMENTOS_VENTA, type DocumentoVenta, type Negocio } from "../types/negocio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Campo = "nombre" | "rut" | "giro" | "direccion" | "telefono" | "email" | "mensajeTicket";
type Form = Record<Campo, string>;

const aForm = (n: Negocio): Form => ({
  nombre: n.nombre ?? "",
  rut: n.rut ?? "",
  giro: n.giro ?? "",
  direccion: n.direccion ?? "",
  telefono: n.telefono ?? "",
  email: n.email ?? "",
  mensajeTicket: n.mensajeTicket ?? "",
});

const CAMPOS: { key: Campo; label: string; placeholder?: string; ayuda?: string }[] = [
  { key: "nombre", label: "Nombre del negocio", placeholder: "Ej. Minimarket La Esquina" },
  { key: "rut", label: "RUT", placeholder: "12.345.678-5" },
  { key: "giro", label: "Giro", placeholder: "Ej. Venta de abarrotes" },
  { key: "direccion", label: "Dirección", placeholder: "Ej. Av. Principal 123, Santiago" },
  { key: "telefono", label: "Teléfono", placeholder: "+56 9 1234 5678" },
  { key: "email", label: "Correo", placeholder: "contacto@minegocio.cl" },
  {
    key: "mensajeTicket",
    label: "Mensaje al pie del comprobante",
    placeholder: "¡Gracias por su compra!",
    ayuda: "Ej. horario de atención, redes sociales o política de cambios.",
  },
];

// Datos que salen en el comprobante impreso y en el menú. Solo admin.
export default function NegocioPage() {
  const { negocio, recargar } = useNegocio();
  const [form, setForm] = useState<Form>(aForm(negocio));
  const [venderSinStock, setVenderSinStock] = useState(negocio.venderSinStock);
  const [agrupar, setAgrupar] = useState(negocio.agruparProductosCaja);
  const [documento, setDocumento] = useState(negocio.documentoVentaDefecto);
  const [maximo, setMaximo] = useState(String(negocio.descuentoMaximoCaja));
  const [errores, setErrores] = useState<Record<string, string[]> | undefined>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(aForm(negocio));
    setVenderSinStock(negocio.venderSinStock);
    setAgrupar(negocio.agruparProductosCaja);
    setDocumento(negocio.documentoVentaDefecto);
    setMaximo(String(negocio.descuentoMaximoCaja));
  }, [negocio]);

  const rutInvalido = form.rut.trim() !== "" && !rutValido(form.rut);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (rutInvalido) {
      toast.error("El RUT no es válido: revisa el dígito verificador");
      return;
    }
    setGuardando(true);
    setErrores(undefined);
    try {
      await negocioApi.actualizar({
        ...form, nombre: form.nombre.trim(), venderSinStock, agruparProductosCaja: agrupar,
        documentoVentaDefecto: documento, descuentoMaximoCaja: Number(maximo),
      });
      await recargar();
      toast.success("Datos del negocio guardados");
    } catch (err) {
      if (err instanceof ApiError) {
        const detalles = err.detalles as { fieldErrors?: Record<string, string[]> } | undefined;
        setErrores(detalles?.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("No se pudieron guardar los datos");
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-info/20 bg-info/8 p-4">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-info/14 text-info">
          <Store size={17} />
        </span>
        <p className="font-body text-sm text-foreground/80">
          Estos datos aparecen en el comprobante de venta que se imprime en Caja. El comprobante es interno: la boleta
          la entrega tu máquina de pago (Mercado Pago, Getnet, etc.).
        </p>
      </div>

      <form onSubmit={guardar} className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary"><Receipt size={17} /></span>
            Datos del negocio
          </h2>
        {CAMPOS.map((c) => {
          const error = c.key === "rut" && rutInvalido ? "RUT inválido (revisa el dígito verificador)" : errores?.[c.key]?.[0];
          return (
            <div key={c.key} className="space-y-1.5">
              <Label htmlFor={`negocio-${c.key}`}>{c.label}</Label>
              <Input
                id={`negocio-${c.key}`}
                value={form[c.key]}
                placeholder={c.placeholder}
                required={c.key === "nombre"}
                type={c.key === "email" ? "email" : "text"}
                onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
                onBlur={c.key === "rut" ? () => setForm((f) => ({ ...f, rut: formatearRut(f.rut.trim()) })) : undefined}
              />
              {c.ayuda && !error && <p className="font-body text-xs text-muted-foreground">{c.ayuda}</p>}
              {error && <p className="font-body text-xs text-destructive">{error}</p>}
            </div>
          );
        })}
        </section>

        <section className="self-start overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="brand-gradient flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25 ring-inset"><Settings2 size={18} /></span>
            <div>
              <h2 className="font-display text-lg leading-tight font-bold tracking-tight">Configuración de caja</h2>
              <p className="text-xs text-white/85">Reglas que se aplican al vender.</p>
            </div>
          </div>
          <div className="divide-y">
            {([
              { id: "vender-sin-stock", checked: venderSinStock, onChange: setVenderSinStock, Icono: PackageX, titulo: "Permitir ventas sin stock", ayuda: "El inventario quedará en negativo por las unidades vendidas sin existencia." },
              { id: "agrupar-productos", checked: agrupar, onChange: setAgrupar, Icono: Rows3, titulo: "Agrupar productos iguales en caja", ayuda: "Cada escaneo suma una unidad en la misma línea del ticket." },
            ] as const).map(({ id, checked, onChange, Icono, titulo, ayuda }) => (
              <div key={id} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-primary/5 sm:px-5">
                <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icono size={16} /></span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">{titulo}</Label>
                  <p id={`${id}-ayuda`} className="text-xs text-muted-foreground">{ayuda}</p>
                </div>
                <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-ayuda`} className="mt-1" />
              </div>
            ))}
          </div>
          <div className="space-y-4 border-t bg-muted/30 p-4 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="documento-venta-defecto">Documento de venta por defecto</Label>
              <Select value={documento} onValueChange={(valor) => setDocumento(valor as DocumentoVenta)}>
                <SelectTrigger id="documento-venta-defecto" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOCUMENTOS_VENTA).map(([id, nombre]) => <SelectItem key={id} value={id}>{nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descuento-maximo-caja" className="flex items-center gap-1.5"><Percent size={14} aria-hidden="true" className="text-primary" /> Descuento máximo en caja (%)</Label>
              <Input id="descuento-maximo-caja" type="number" required min={0} max={100} step={1} value={maximo} onChange={(event) => setMaximo(event.target.value)} />
              <p className="text-xs text-muted-foreground">Se aplica al descuento por producto y al total del ticket. Con 0 % se desactivan los descuentos.</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" size="lg" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
