export interface HistorialPrecio {
  id: string;
  productoId: string;
  precioCompraAnterior: number;
  precioCompraNuevo: number;
  precioVentaAnterior: number;
  precioVentaNuevo: number;
  usuarioId: string | null;
  usuario: { id: string; nombre: string } | null;
  fecha: string;
}
