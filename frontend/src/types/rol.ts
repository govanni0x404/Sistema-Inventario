export interface RolCatalogo {
  id: string;
  nombre: string;
  protegido: boolean;
  activo: boolean;
}

export type RolInput = { nombre: string; activo?: boolean };
