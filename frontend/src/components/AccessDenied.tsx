import { ShieldOff } from "lucide-react";

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
        <ShieldOff size={21} />
      </span>
      <h2 className="font-display text-lg font-semibold">Sin acceso</h2>
      <p className="max-w-sm text-sm text-muted-foreground">Pide a un administrador que revise los permisos de tu rol.</p>
    </div>
  );
}
