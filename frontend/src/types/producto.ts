export interface Proveedor {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  categoria: string | null;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidad: string;
  proveedorId: string | null;
  proveedor: Proveedor | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export type ProductoInput = {
  sku: string;
  nombre: string;
  categoria?: string;
  precioCompra?: number;
  precioVenta: number;
  stock?: number;
  stockMinimo?: number;
  unidad: string;
  proveedorId?: string | null;
};
