import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { Seccion } from "../types/auth";

export default function RequireSeccion({ seccion, children }: { seccion: Seccion; children: ReactNode }) {
  const { usuario } = useAuth();
  const permitido = usuario?.rol === "admin" || usuario?.permisos?.[seccion] !== false;

  if (!permitido) {
    return (
      <div className="font-body text-sm text-center py-16 text-ink-soft">
        <p className="font-display text-lg font-semibold text-ink mb-1">Sin acceso</p>
        <p>No tienes permiso para ver esta sección. Pídele a un administrador que te lo habilite.</p>
      </div>
    );
  }

  return <>{children}</>;
}
