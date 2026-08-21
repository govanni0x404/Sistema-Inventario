import type { VentaItem, VentaPago } from "./venta";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  creadoEn: string;
}

export interface ClienteConVentas extends Cliente {
  ventas: {
    id: string;
    fecha: string;
    total: number;
    pagos: VentaPago[];
    items: VentaItem[];
  }[];
}

export type ClienteInput = {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};
