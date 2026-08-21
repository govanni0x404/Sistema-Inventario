export interface Categoria {
  id: string;
  nombre: string;
  activo: boolean;
}

export type CategoriaInput = { nombre: string; activo?: boolean };
