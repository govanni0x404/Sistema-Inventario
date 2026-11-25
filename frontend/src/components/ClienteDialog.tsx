import { useState } from "react";
import { toast } from "sonner";
import { clientesApi } from "@/api/clientes";
import { ApiError } from "@/api/client";
import type { Cliente, ClienteInput } from "@/types/cliente";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EntityForm, { type FieldDef } from "./EntityForm";

const fields: FieldDef[] = [
  { key: "nombre", label: "Nombre" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Correo", type: "email" },
  { key: "direccion", label: "Dirección" },
];

export default function ClienteDialog({ cliente, cerrar, guardado }: {
  cliente?: Cliente;
  cerrar: () => void;
  guardado: (cliente: Cliente) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  async function guardar(data: Record<string, string>) {
    setSaving(true);
    setFieldErrors(undefined);
    const input: ClienteInput = {
      nombre: data.nombre.trim(),
      telefono: data.telefono?.trim() || undefined,
      email: data.email?.trim() || undefined,
      direccion: data.direccion?.trim() || undefined,
    };
    try {
      const resultado = cliente ? await clientesApi.actualizar(cliente.id, input) : await clientesApi.crear(input);
      guardado(resultado);
      toast.success(cliente ? "Cliente actualizado" : "Cliente creado");
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors((error.detalles as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors);
      }
      toast.error(error instanceof ApiError ? error.message : "Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) cerrar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription className="sr-only">Datos de contacto del cliente.</DialogDescription>
        </DialogHeader>
        <EntityForm fields={fields} initial={cliente ? { ...cliente } : undefined} fieldErrors={fieldErrors}
          onCancel={cerrar} onSave={guardar} saving={saving} />
      </DialogContent>
    </Dialog>
  );
}
