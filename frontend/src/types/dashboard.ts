export interface DashboardResumen {
  kpis: {
    ventasHoy: { total: number; cantidad: number };
    ventasMes: { total: number; cantidad: number };
    ticketPromedioMes: number;
    productosActivos: number;
    productosStockBajo: number;
    valorInventario: number;
  };
  ventasPorDia: { fecha: string; total: number; cantidad: number }[];
  ventasPorMetodo: { metodoPago: string; total: number }[];
  productosTop: { productoId: string; nombre: string; sku: string; cantidad: number; subtotal: number }[];
  stockBajo: { id: string; nombre: string; sku: string; stock: number; stockMinimo: number; unidad: string }[];
}
