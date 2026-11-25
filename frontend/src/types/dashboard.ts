export interface DashboardResumen {
  rango: { desde: string; hasta: string; dias: number };
  kpis: {
    ventasHoy: { total: number; cantidad: number };
    ventasPeriodo: { total: number; cantidad: number };
    ticketPromedioPeriodo: number;
    productosActivos: number;
    productosStockBajo: number;
    valorInventario: number;
  };
  ventasPorDia: { fecha: string; total: number; cantidad: number }[];
  ventasPorMetodo: { metodoPago: string; total: number }[];
  ventasPorUsuario: { usuarioId: string | null; nombre: string; cantidad: number; total: number }[];
  ventasRecientes: {
    id: string;
    fecha: string;
    usuario: string | null;
    total: number;
    esCortesia: boolean;
    pagos: { metodoPago: string; monto: number }[];
  }[];
  productosTop: { productoId: string; nombre: string; codigoBarras: string | null; cantidad: number; subtotal: number }[];
  stockBajo: { id: string; nombre: string; codigoBarras: string | null; stock: number; stockMinimo: number; unidad: string }[];
}
