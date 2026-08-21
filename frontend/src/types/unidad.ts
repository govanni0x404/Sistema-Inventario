export interface Unidad {
  id: string;
  nombre: string;
  activo: boolean;
}

export type UnidadInput = { nombre: string; activo?: boolean };
