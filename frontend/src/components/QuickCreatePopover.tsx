import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError } from "../api/client";

export default function QuickCreatePopover({
  label,
  placeholder,
  onCreate,
}: {
  label: string;
  placeholder?: string;
  onCreate: (nombre: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const crear = async () => {
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      await onCreate(nombre.trim());
      setNombre("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `No se pudo crear ${label.toLowerCase()}`);
    } finally {
      setCreando(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={`Nueva ${label.toLowerCase()}`}>
          <Plus size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <div className="font-body text-xs font-medium text-muted-foreground">Nueva {label.toLowerCase()}</div>
        <Input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              crear();
            }
          }}
        />
        <Button type="button" size="sm" className="w-full" onClick={crear} disabled={creando || !nombre.trim()}>
          {creando ? "Creando..." : "Crear"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
