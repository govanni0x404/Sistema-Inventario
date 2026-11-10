import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { negocioApi, setupApi } from "../api/negocio";
import { useAuth } from "./AuthContext";
import type { Negocio } from "../types/negocio";

const VACIO: Negocio = {
  nombre: "Mi Negocio",
  rut: null,
  giro: null,
  direccion: null,
  telefono: null,
  email: null,
  mensajeTicket: null,
};

type NegocioState = {
  negocio: Negocio;
  recargar: () => Promise<void>;
};

const NegocioContext = createContext<NegocioState | null>(null);

// Datos del negocio para toda la app (nombre en el menú, comprobante impreso).
// Sin sesión solo se conoce el nombre (ruta pública /setup, para la pantalla de login);
// con sesión se cargan todos los datos.
export function NegocioProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [negocio, setNegocio] = useState<Negocio>(VACIO);

  const recargar = useCallback(async () => {
    try {
      if (usuario) {
        setNegocio(await negocioApi.obtener());
      } else {
        const estado = await setupApi.estado();
        setNegocio({ ...VACIO, nombre: estado.nombreNegocio });
      }
    } catch {
      // Sin conexión: se mantiene lo último conocido.
    }
  }, [usuario]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    document.title = negocio.nombre;
  }, [negocio.nombre]);

  return <NegocioContext.Provider value={{ negocio, recargar }}>{children}</NegocioContext.Provider>;
}

export function useNegocio() {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio debe usarse dentro de NegocioProvider");
  return ctx;
}
