import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  venderSinStock: false,
  agruparProductosCaja: true,
  documentoVentaDefecto: "interno",
  descuentoMaximoCaja: 100,
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
  // Cada carga recibe un número; solo se aplica la respuesta de la más reciente
  // (evita que una respuesta lenta de la sesión anterior pise la actual).
  const ultimaCarga = useRef(0);
  const conSesion = usuario !== null;

  const recargar = useCallback(async () => {
    const carga = ++ultimaCarga.current;
    try {
      if (conSesion) {
        const datos = await negocioApi.obtener();
        if (carga === ultimaCarga.current) setNegocio(datos);
      } else {
        const estado = await setupApi.estado();
        if (carga === ultimaCarga.current) setNegocio({ ...VACIO, nombre: estado.nombreNegocio });
      }
    } catch {
      // Sin conexión: se mantiene lo último conocido.
    }
  }, [conSesion]);

  useEffect(() => {
    // Al cerrar sesión se descartan los datos completos del negocio; solo se conserva el nombre.
    if (!conSesion) setNegocio((actual) => ({ ...VACIO, nombre: actual.nombre }));
    recargar();
  }, [conSesion, recargar]);

  return <NegocioContext.Provider value={{ negocio, recargar }}>{children}</NegocioContext.Provider>;
}

export function useNegocio() {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio debe usarse dentro de NegocioProvider");
  return ctx;
}
