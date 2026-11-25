export const DOCUMENTOS_VENTA = { interno: "Comprobante interno" } as const;
export type DocumentoVenta = keyof typeof DOCUMENTOS_VENTA;

export interface Negocio {
  nombre: string;
  rut: string | null;
  giro: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  mensajeTicket: string | null;
  venderSinStock: boolean;
  agruparProductosCaja: boolean;
  documentoVentaDefecto: DocumentoVenta;
  descuentoMaximoCaja: number;
}

export type NegocioInput = Partial<Negocio> & { nombre: string };

export interface EstadoSetup {
  necesitaConfiguracion: boolean;
  requiereClave: boolean;
  nombreNegocio: string;
}

export interface SetupInput {
  clave?: string;
  negocio: NegocioInput;
  admin: { nombre: string; email: string; password: string };
}
