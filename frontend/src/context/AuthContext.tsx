import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api/auth";
import { getToken, setToken, setSessionExpiredHandler } from "../api/client";
import type { Usuario } from "../types/auth";

type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Deja la sesión iniciada con un token ya obtenido (p. ej. tras la configuración inicial). */
  iniciarSesion: (token: string, usuario: Usuario) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
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
    authApi
      .me()
      .then(setUsuario)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const iniciarSesion = (token: string, u: Usuario) => {
    setToken(token);
    setUsuario(u);
  };

  const login = async (email: string, password: string) => {
    const { token, usuario: u } = await authApi.login(email, password);
    iniciarSesion(token, u);
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, login, iniciarSesion, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
