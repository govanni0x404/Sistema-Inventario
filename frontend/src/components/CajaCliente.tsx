import { useState } from "react";
import { ChevronDown, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesSearch, normalizeSearch } from "@/lib/search";
import type { Cliente } from "@/types/cliente";
import ClienteDialog from "./ClienteDialog";

export default function CajaCliente({ clientes, clienteId, seleccionar, creado, puedeCrear }: {
  clientes: Cliente[];
  clienteId: string;
  seleccionar: (id: string) => void;
  creado: (cliente: Cliente) => void;
  puedeCrear: boolean;
}) {
  const [modal, setModal] = useState<"seleccionar" | "crear" | null>(null);
  const [consulta, setConsulta] = useState("");
  const cliente = clientes.find((item) => item.id === clienteId);
  const candidatos = clientes.filter((item) => matchesSearch(normalizeSearch(consulta), [item.nombre, item.telefono, item.email]));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">Cliente de la venta</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="min-w-0 flex-1 justify-start" onClick={() => { setConsulta(""); setModal("seleccionar"); }}>
          <UserRound size={17} className="text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{cliente?.nombre ?? "Cliente general"}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
        {clienteId && <Button type="button" variant="outline" size="icon" aria-label="Quitar cliente seleccionado" onClick={() => seleccionar("")}><X size={16} /></Button>}
      </div>
      <Dialog open={modal === "seleccionar"} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Seleccionar cliente</DialogTitle>
            <DialogDescription>Busca por nombre, teléfono o correo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Input autoFocus aria-label="Buscar cliente" className="min-w-40 flex-1" value={consulta} onChange={(event) => setConsulta(event.target.value)} />
            {puedeCrear && <Button type="button" onClick={() => setModal("crear")}><Plus size={16} /> Nuevo cliente</Button>}
          </div>
          <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border">
            {candidatos.map((item) => (
              <li key={item.id}>
                <button type="button" className="w-full p-3 text-left hover:bg-muted" onClick={() => { seleccionar(item.id); setModal(null); }}>
                  <span className="block text-sm font-semibold">{item.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{[item.email, item.telefono].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
            {!candidatos.length && <li className="p-3 text-sm text-muted-foreground">No se encontraron clientes.</li>}
          </ul>
        </DialogContent>
      </Dialog>
      {modal === "crear" && <ClienteDialog cerrar={() => setModal("seleccionar")} guardado={(item) => { creado(item); setModal(null); }} />}
    </div>
  );
}
