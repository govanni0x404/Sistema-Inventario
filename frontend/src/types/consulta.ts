export interface RangoConsulta {
  desde: string;
  hasta: string;
}

export interface ProductoTop {
  productoId: string;
  nombre: string;
  sku: string;
  cantidad: number;
  subtotal: number;
}

export interface ProductosTopResponse {
  rango: RangoConsulta;
  productos: ProductoTop[];
}

export interface VentasPorMetodoItem {
  metodoPago: string;
  total: number;
  cantidad: number;
}

export interface VentasPorMetodoResponse {
  rango: RangoConsulta;
  metodos: VentasPorMetodoItem[];
}

export interface VentasPorUsuarioItem {
  usuarioId: string | null;
  nombre: string;
  cantidadVentas: number;
  total: number;
  cantidadCortesias: number;
}

export interface VentasPorUsuarioResponse {
  rango: RangoConsulta;
  usuarios: VentasPorUsuarioItem[];
}

export type ConsultaParams = { dias?: number; desde?: string; hasta?: string };
