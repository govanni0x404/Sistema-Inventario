// El rol es un string libre gestionado por el catálogo de Roles (admin/cajero son los
// únicos garantizados a existir siempre; "admin" es protegido). No es una unión fija
// porque un administrador puede crear roles nuevos desde /roles.
export type Rol = string;

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
  | "historial"
  | "consultas";

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
