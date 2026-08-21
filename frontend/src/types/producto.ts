export interface Proveedor {
  id: string;
  nombre: string;
}

export interface CategoriaProducto {
  id: string;
  nombre: string;
}

export interface UnidadProducto {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  sku: string;
  codigoBarras: string | null;
  nombre: string;
  categoriaId: string | null;
  categoria: CategoriaProducto | null;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidadId: string;
  unidad: UnidadProducto;
  proveedorId: string | null;
  proveedor: Proveedor | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export type ProductoInput = {
  sku: string;
  codigoBarras?: string | null;
  nombre: string;
  categoriaId?: string | null;
  precioCompra?: number;
  precioVenta: number;
  stock?: number;
  stockMinimo?: number;
  unidadId: string;
  proveedorId?: string | null;
};

export interface ImportarResultadoFila {
  fila: number;
  sku: string | null;
  ok: boolean;
  accion?: "creado" | "actualizado";
  nota?: string;
  error?: string;
}

export interface ImportarResultado {
  resumen: { total: number; creados: number; actualizados: number; errores: number };
  resultados: ImportarResultadoFila[];
}
