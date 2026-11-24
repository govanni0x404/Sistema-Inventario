import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { Seccion } from "../types/auth";
import AccessDenied from "./AccessDenied";
import { tieneAcceso } from "./nav-data";

export default function RequireSeccion({ seccion, children }: { seccion: Seccion; children: ReactNode }) {
  const { usuario } = useAuth();
  return tieneAcceso(usuario, { seccion }) ? <>{children}</> : <AccessDenied />;
}
