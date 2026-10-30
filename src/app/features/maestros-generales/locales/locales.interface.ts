export type TipoAsignacionLocal = 'EMPRESA' | 'CENTRO_COSTO';

export interface LocalItem {
  id: number;
  codigo: string;
  nombre: string;
  direccion: string | null;
  id_empresa: number | null;
  empresa_nombre: string | null;
  id_centro_costo: number | null;
  centro_costo_codigo: string | null;
  centro_costo_nombre: string | null;
  tipo_asignacion: TipoAsignacionLocal;
  estado: boolean;
}

export interface CreateLocalPayload {
  codigo?: string;
  nombre?: string;
  direccion?: string;
  id_empresa?: number;
  id_centro_costo?: number;
  estado?: boolean;
}

export interface UpdateLocalPayload {
  nombre?: string;
  direccion?: string;
  id_empresa?: number;
  id_centro_costo?: number;
  estado?: boolean;
}

export interface AreaItem {
  id: number;
  codigo?: string;
  nombre: string;
  estado?: boolean;
}

export interface UbicacionItem {
  id: number;
  codigo: string;
  id_local: number;
  local_codigo?: string;
  local_nombre?: string;
  local_tipo_asignacion?: TipoAsignacionLocal;
  local_asignado_a?: string | null;
  id_nivel: number;
  nivel_codigo?: string;
  nivel_descripcion?: string;
  id_ambiente: number;
  ambiente_codigo?: string;
  ambiente_descripcion?: string;
  id_area: number | null;
  area_codigo?: string | null;
  area_nombre?: string | null;
  observaciones: string | null;
  estado: boolean;
}

export interface CreateUbicacionPayload {
  codigo?: string;
  id_local: number;
  id_nivel: number;
  id_ambiente: number;
  id_area?: number | null;
  observaciones?: string | null;
  estado?: boolean;
}

export interface UpdateUbicacionPayload {
  codigo?: string;
  id_local?: number;
  id_nivel?: number;
  id_ambiente?: number;
  id_area?: number | null;
  observaciones?: string | null;
  estado?: boolean;
}

