import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import AccessDenied from "./AccessDenied";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  return usuario?.rol === "admin" ? <>{children}</> : <AccessDenied />;
}
