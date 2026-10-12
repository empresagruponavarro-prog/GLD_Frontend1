export type TipoAnexo = 'Proveedor' | 'Cliente' | 'Trabajador';

export interface Anexo {
  id: number;
  tipoAnexo: TipoAnexo | null;
  AnexoEspecialidadId: number | null;
  AnexoTipoDocIdeId: number | null;
  NumeroDocIde: string | null;
  Anexo: string | null;
  NombreComercial: string | null;
  Direccion: string | null;
  Contacto: string | null;
  Telefono: string | null;
  Correo: string | null;
  /** Cuenta de detracciones del proveedor (Banco de la Nación). */
  cuenta_detraccion?: string | null;
  /** Buen contribuyente o agente de retención/percepción: no se le retiene el IGV. */
  exceptuado_retencion?: boolean;
  estado: boolean;
}

export interface AnexoSelect {
  id: number;
  nombre: string;
}

export interface AnexoQuery {
  page?: number;
  pageSize?: number;
  tipoAnexo?: TipoAnexo;
  AnexoEspecialidadId?: number;
  AnexoTipoDocIdeId?: number;
  Anexo?: string;
  NombreComercial?: string;
  estado?: boolean;
}

export interface AnexoPaginated {
  data: Anexo[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  id: number;
  nombre: string | null;
}
