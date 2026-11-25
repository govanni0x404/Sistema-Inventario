import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background font-body text-sm text-muted-foreground">Cargando…</div>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
