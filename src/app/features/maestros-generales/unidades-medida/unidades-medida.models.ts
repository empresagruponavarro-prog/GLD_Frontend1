/** Unidad de medida (`GET /maestros/unidad-medida`). */
export interface UnidadMedida {
  id: number;
  codigo: string;
  descripcion: string;
  simbolo: string | null;
  estado: boolean;
}

/** Opción del selector (`GET /maestros/unidad-medida/select`): descripción y símbolo. */
export interface UnidadMedidaOpcion {
  id: number;
  nombre: string;
}

/** Equivalencia de una unidad origen: 1 origen = `factor_conversion` destino. */
export interface Equivalencia {
  id: number;
  id_uni_med_origen: number;
  id_uni_med_destino: number;
  factor_conversion: string;
  estado: boolean;
}

/** Campo por el que filtra el buscador de la lista. */
export type CampoBusqueda = 'descripcion' | 'codigo';

/** Filtro de estado de la lista: todas, solo activas o solo inactivas. */
export type FiltroEstado = 'todas' | 'activas' | 'inactivas';

export interface UnidadMedidaQuery {
  page: number;
  pageSize: number;
  campo: CampoBusqueda;
  texto: string;
  estado: FiltroEstado;
}

export interface UnidadMedidaGuardar {
  codigo: string;
  descripcion: string;
  simbolo?: string;
  estado?: boolean;
}

export interface EquivalenciaGuardar {
  id_uni_med_destino: number;
  factor_conversion: string;
  estado?: boolean;
}
