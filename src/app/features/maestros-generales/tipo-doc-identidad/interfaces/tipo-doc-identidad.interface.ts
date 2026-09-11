export type TipoAnexo = 'Proveedor' | 'Cliente' | 'Trabajador';

export interface TipoDocIdentidad {
  id: number;
  tipoAnexo: TipoAnexo | null;
  descripcion: string | null;
}

export interface TipoDocIdentidadQuery {
  page?: number;
  pageSize?: number;
  tipoAnexo?: TipoAnexo;
  descripcion?: string;
}

export interface TipoDocIdentidadPaginated {
  data: TipoDocIdentidad[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
