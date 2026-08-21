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
  productosTop: { productoId: string; nombre: string; sku: string; cantidad: number; subtotal: number }[];
  stockBajo: { id: string; nombre: string; sku: string; stock: number; stockMinimo: number; unidad: string }[];
}
