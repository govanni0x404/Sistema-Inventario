import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function CambiarPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setActual("");
    setNueva("");
    setRepetir("");
    onClose();
  };

  const noCoinciden = repetir !== "" && nueva !== repetir;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (nueva.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (nueva !== repetir) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    setGuardando(true);
    try {
      await authApi.cambiarPassword(actual, nueva);
      toast.success("Contraseña actualizada");
      cerrar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar mi contraseña</DialogTitle>
          <DialogDescription>Usa al menos 8 caracteres.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-actual">Contraseña actual</Label>
            <Input id="pw-actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-nueva">Nueva contraseña</Label>
            <Input id="pw-nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-repetir">Repite la nueva contraseña</Label>
            <Input id="pw-repetir" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
            {noCoinciden && <p className="font-body text-xs text-destructive">No coinciden</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
