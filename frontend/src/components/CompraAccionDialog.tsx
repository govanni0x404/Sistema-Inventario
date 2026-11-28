import { useState, type FormEvent } from "react";
import { comprasApi, saldoRecepcion, type AccionCompra, type DetalleCompra, type OperacionCompra } from "@/api/compras";
import { ApiError } from "@/api/client";
import { idOperacion } from "@/lib/idOperacion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type Accion = { tipo: AccionCompra | "recibir" } | { tipo: "devolver"; recepcion: OperacionCompra };

const titulos = {
  emitir: "Emitir orden",
  cerrar: "Cerrar saldo pendiente",
  anular: "Anular orden",
  recibir: "Registrar recepción",
  devolver: "Devolver al proveedor",
};
const descripciones = {
  emitir: "Al emitirla podrás imprimir la orden y registrar sus recepciones.",
  cerrar: "El saldo pendiente dejará de contarse para reposición. Las entradas ya registradas se conservan.",
  anular: "La orden quedará en el historial y su saldo dejará de contarse para reposición.",
  recibir: "Ingresa las unidades que llegaron y el número de la guía, factura o documento interno.",
  devolver: "Indica las unidades que salen de la bodega y el documento de respaldo.",
};

export default function CompraAccionDialog({ orden, accion, onClose, onSave }: {
  orden: DetalleCompra;
  accion: Accion;
  onClose: () => void;
  onSave: (orden: DetalleCompra) => void;
}) {
  const [id] = useState(idOperacion);
  const [documento, setDocumento] = useState("");
  const [nota, setNota] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const esOperacion = accion.tipo === "recibir" || accion.tipo === "devolver";
  const requiereMotivo = accion.tipo === "cerrar" || accion.tipo === "anular";
  const saldo = accion.tipo === "devolver" ? saldoRecepcion(orden, accion.recepcion)
    : new Map(orden.items.map((item) => [item.id, item.cantidad - item.recibida]));
  const lineas = orden.items.filter((item) => (saldo.get(item.id) ?? 0) > 0);
  const items = lineas.map((item) => ({ itemId: item.id, cantidad: Number(cantidades[item.id] || 0) }))
    .filter((item) => item.cantidad > 0);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const guardada = accion.tipo === "recibir" || accion.tipo === "devolver"
        ? await comprasApi.registrar(orden.id, { id, documento, nota, items,
          recepcionId: accion.tipo === "devolver" ? accion.recepcion.id : undefined,
        })
        : await comprasApi.cambiarEstado(orden, accion.tipo, nota);
      onSave(guardada);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la operación.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !ocupado) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-2xl" showCloseButton={!ocupado}>
        <DialogHeader>
          <DialogTitle>{titulos[accion.tipo]} · OC #{orden.folio}</DialogTitle>
          <DialogDescription>{descripciones[accion.tipo]}</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar}>
          <fieldset disabled={ocupado} className="space-y-4">
            {esOperacion && <>
              <label className="grid gap-1.5 text-sm font-medium">Documento de respaldo
                <Input required maxLength={120} value={documento} onChange={(e) => setDocumento(e.target.value)}
                  placeholder={accion.tipo === "devolver" ? "Ej. Nota de crédito 183" : "Ej. Guía 1452"} />
              </label>
              <div className="space-y-2">
                {accion.tipo === "recibir" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setCantidades(Object.fromEntries(
                    lineas.map((item) => [item.id, String(saldo.get(item.id))]),
                  ))}>Completar saldo pendiente</Button>
                )}
                <ul className="divide-y rounded-lg border">
                  {lineas.map((item) => (
                    <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 p-3">
                      <div className="text-sm font-medium">{item.productoNombre}
                        <p className="text-xs font-normal text-muted-foreground">Máximo {saldo.get(item.id)}</p>
                      </div>
                      <Input type="number" min={0} step={1} max={saldo.get(item.id)}
                        aria-label={`Cantidad de ${item.productoNombre}`} placeholder="0"
                        value={cantidades[item.id] ?? ""} onChange={(e) => setCantidades({ ...cantidades, [item.id]: e.target.value })} />
                    </li>
                  ))}
                </ul>
              </div>
            </>}
            {(esOperacion || requiereMotivo) && (
              <label className="grid gap-1.5 text-sm font-medium">{requiereMotivo ? "Motivo" : "Observaciones"}
                <Input required={requiereMotivo} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
              </label>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant={requiereMotivo ? "destructive" : "default"}
                disabled={(esOperacion && (!items.length || !documento.trim())) || (requiereMotivo && !nota.trim())}>
                {ocupado ? "Guardando…" : titulos[accion.tipo]}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
