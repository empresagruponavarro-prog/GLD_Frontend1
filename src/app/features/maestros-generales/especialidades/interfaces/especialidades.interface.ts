export type TipoAnexo = 'Proveedor' | 'Cliente' | 'Trabajador';

export interface Especialidad {
  id: number;
  tipoAnexo: TipoAnexo | null;
  descripcion: string | null;
}

export interface EspecialidadQuery {
  page?: number;
  pageSize?: number;
  tipoAnexo?: TipoAnexo;
  descripcion?: string;
}

export interface EspecialidadPaginated {
  data: Especialidad[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
