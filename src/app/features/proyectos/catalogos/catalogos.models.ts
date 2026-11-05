/** Modelos de los catálogos de proyecto (GRP): tipos de proyecto, tipos de plano y años fiscales. */

export interface TipoPlano {
  id: number;
  codigo: string;
  nombre: string;
  disciplina: string | null;
  activo: boolean;
  orden: number;
}

export interface TipoProyectoPlano {
  id_tipo_plano: number;
  codigo: string;
  nombre: string;
  /** Si falta, bloquea la liquidación y el dosier de la obra. */
  obligatorio: boolean;
}

export interface TipoProyecto {
  id: number;
  nombre: string;
  activo: boolean;
  orden: number;
  planos: TipoProyectoPlano[];
}

export interface PeriodoFiscal {
  anio: number;
  activo: boolean;
}

export interface TipoProyectoPayload {
  nombre: string;
  orden?: number;
}

export interface TipoPlanoPayload {
  codigo: string;
  nombre: string;
  disciplina?: string;
  orden?: number;
}

/** Un plano de la lista de un tipo de proyecto (la lista completa reemplaza a la anterior). */
export interface PlanoDeTipoPayload {
  id_tipo_plano: number;
  obligatorio: boolean;
}
