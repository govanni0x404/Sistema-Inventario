import type { Producto } from "./producto";

export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  creadoEn: string;
}

export interface ProveedorConProductos extends Proveedor {
  productos: Producto[];
}

export type ProveedorInput = {
  nombre: string;
  telefono?: string;
  email?: string;
  contacto?: string;
};
