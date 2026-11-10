import { api } from "./client";
import type { LoginResponse } from "../types/auth";
import type { EstadoSetup, Negocio, NegocioInput, SetupInput } from "../types/negocio";

export const negocioApi = {
  obtener: () => api.get<Negocio>("/negocio"),
  actualizar: (data: NegocioInput) => api.put<Negocio>("/negocio", data),
};

export const setupApi = {
  estado: () => api.get<EstadoSetup>("/setup"),
  configurar: (data: SetupInput) => api.post<LoginResponse>("/setup", data),
};
