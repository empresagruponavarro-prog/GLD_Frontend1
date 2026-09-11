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
  estado: boolean;
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
