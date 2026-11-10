import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { negocioApi } from "../api/negocio";
import { ApiError } from "../api/client";
import { useNegocio } from "../context/NegocioContext";
import { formatearRut, rutValido } from "../lib/rut";
import type { Negocio } from "../types/negocio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Form = Record<keyof Negocio, string>;

const aForm = (n: Negocio): Form => ({
  nombre: n.nombre ?? "",
  rut: n.rut ?? "",
  giro: n.giro ?? "",
  direccion: n.direccion ?? "",
  telefono: n.telefono ?? "",
  email: n.email ?? "",
  mensajeTicket: n.mensajeTicket ?? "",
});

const CAMPOS: { key: keyof Negocio; label: string; placeholder?: string; ayuda?: string }[] = [
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
  const [errores, setErrores] = useState<Record<string, string[]> | undefined>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(aForm(negocio));
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
      await negocioApi.actualizar({ ...form, nombre: form.nombre.trim() });
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
    <div className="max-w-2xl">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
          <Store size={16} />
        </span>
        <p className="font-body text-xs text-muted-foreground">
          Estos datos aparecen en el comprobante de venta que se imprime en Caja. El comprobante es interno: la boleta
          la entrega tu máquina de pago (Mercado Pago, Getnet, etc.).
        </p>
      </div>

      <form onSubmit={guardar} className="space-y-4">
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

        <div className="flex justify-end">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
