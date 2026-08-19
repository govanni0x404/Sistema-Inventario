export type Rol = "admin" | "cajero";

export type Seccion =
  | "dashboard"
  | "caja"
  | "turnos"
  | "productos"
  | "stock"
  | "bodega"
  | "precios"
  | "clientes"
  | "proveedores"
  | "historial";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  permisos: Record<Seccion, boolean>;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
