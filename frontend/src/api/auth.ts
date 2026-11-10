import { api } from "./client";
import type { LoginResponse, Usuario } from "../types/auth";

export const authApi = {
  login: (email: string, password: string) => api.post<LoginResponse>("/auth/login", { email, password }),
  me: () => api.get<Usuario>("/auth/me"),
  cambiarPassword: (actual: string, nueva: string) => api.put<{ ok: true }>("/auth/password", { actual, nueva }),
};
