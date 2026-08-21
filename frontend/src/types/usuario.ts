import type { Rol } from "./auth";

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export type UsuarioInput = {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
};

export type UsuarioUpdateInput = {
  nombre?: string;
  rol?: Rol;
  activo?: boolean;
};
