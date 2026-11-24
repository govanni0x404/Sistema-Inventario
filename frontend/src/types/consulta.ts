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

export interface ProductoMargen {
  productoId: string;
  nombre: string;
  sku: string;
  cantidad: number;
  ingreso: number;
  costo: number;
  costoEstimado: boolean;
  margen: number;
  margenPct: number;
}

export interface ProductosMargenResponse {
  rango: RangoConsulta;
  productos: ProductoMargen[];
}

export type ConsultaParams = { dias?: number; desde?: string; hasta?: string };

export interface DetalleReporteResponse<T> {
  filas: T[];
  truncado: boolean;
}

interface FilaVenta {
  id: string;
  ventaId: string;
  fecha: string;
}

export interface DetallePago extends FilaVenta {
  operacion: "cobro" | "reembolso";
  cliente: string | null;
  metodoPago: string | null;
  monto: number;
}

export interface DetalleProducto extends FilaVenta {
  esCortesia: boolean;
  producto: string;
  sku: string;
  cantidad: number;
  cantidadDevuelta: number;
  subtotal: number;
}
