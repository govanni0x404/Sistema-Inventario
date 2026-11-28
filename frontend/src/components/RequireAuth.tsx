import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, loading, errorSesion, reintentarSesion } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background font-body text-sm text-muted-foreground">Cargando…</div>;
  }

  if (errorSesion) {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4 text-center font-body text-sm">
        <p className="text-foreground">No se pudo verificar tu sesión.</p>
        <p className="text-muted-foreground">{errorSesion}</p>
        <Button onClick={reintentarSesion}>Reintentar</Button>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
