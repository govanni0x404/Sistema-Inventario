import type { ReactNode } from "react";
import { ShieldOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Seccion } from "../types/auth";

export default function RequireSeccion({ seccion, children }: { seccion: Seccion; children: ReactNode }) {
  const { usuario } = useAuth();
  const permitido = usuario?.rol === "admin" || usuario?.permisos?.[seccion] !== false;

  if (!permitido) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-16">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground">
          <ShieldOff size={20} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-foreground mb-1">Sin acceso</p>
          <p className="font-body text-sm text-muted-foreground">
            No tienes permiso para ver esta sección. Pídele a un administrador que te lo habilite.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
