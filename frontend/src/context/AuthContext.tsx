import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api/auth";
import { ApiError, getToken, setToken, setSessionExpiredHandler } from "../api/client";
import type { Usuario } from "../types/auth";

type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
  /** Error al validar la sesión guardada (sin conexión, servidor caído). El token se conserva. */
  errorSesion: string | null;
  /** Vuelve a validar la sesión guardada tras un error. */
  reintentarSesion: () => void;
  login: (email: string, password: string) => Promise<void>;
  /** Deja la sesión iniciada con un token ya obtenido (p. ej. tras la configuración inicial). */
  iniciarSesion: (token: string, usuario: Usuario) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
    setErrorSesion(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let vigente = true;
    authApi
      .me()
      .then((u) => {
        if (!vigente) return;
        setUsuario(u);
        setErrorSesion(null);
      })
      .catch((error) => {
        if (!vigente) return;
        if (error instanceof ApiError && error.status === 401) {
          // Sesión inválida o expirada: se descarta el token y se pide iniciar sesión.
          setToken(null);
          setErrorSesion(null);
        } else {
          // Sin conexión o error del servidor: se conserva el token para reintentar.
          setErrorSesion(
            error instanceof ApiError && error.status > 0
              ? error.message
              : "No se pudo conectar con el servidor.",
          );
        }
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentarSesion = useCallback(() => {
    setErrorSesion(null);
    setLoading(true);
    setIntento((n) => n + 1);
  }, []);

  const iniciarSesion = (token: string, u: Usuario) => {
    setToken(token);
    setUsuario(u);
    setErrorSesion(null);
  };

  const login = async (email: string, password: string) => {
    const { token, usuario: u } = await authApi.login(email, password);
    iniciarSesion(token, u);
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, errorSesion, reintentarSesion, login, iniciarSesion, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
