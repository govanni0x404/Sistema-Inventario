import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  if (usuario?.rol !== "admin") {
    return <Navigate to="/caja" replace />;
  }

  return <>{children}</>;
}
