import type {
  CurvaS,
  EquipoObra,
  EstadoObra,
  MetricasItem,
  PartidaResultado,
  PersonaObra,
  PlazosObra,
  PostVentaInfo,
  Situacion,
} from '../centros-costos/obra-cockpit/obra-control.interface';

export type { EquipoObra, EstadoObra, PersonaObra, Situacion };

/** Punto de la mini Curva S de una obra (pactado y real por semana). */
export interface PuntoCurvaResumen {
  semana: number;
  pactado: number;
  real: number | null;
}

/** Resultado del motor sin el árbol de partidas (lo que trae el portafolio por obra). */
export interface ResultadoResumen extends MetricasItem {
  estadoEfectivo: EstadoObra;
  sinPartidas: boolean;
  sinAvance: boolean;
  semana: { actual: number; total: number; texto: string; tarde: boolean };
  plazos: PlazosObra;
  postVenta: PostVentaInfo | null;
  corte: string;
  adicionales: { subpartidas: number; avance: number; pesoPct: number } | null;
  /** Cantidad de avisos de carga. */
  avisos: number;
}

/** Una fila por obra del portafolio (`GET operaciones/portafolio`). */
export interface ObraResumen {
  id_centro_costo: number;
  codigo_obra: string | null;
  /** Cliente + tienda. */
  nombre: string;
  cliente: PersonaObra | null;
  tienda: string | null;
  departamento: string | null;
  comentario: string | null;
  equipo: EquipoObra;
  /** Estado guardado; el efectivo (derivado de las fechas) está en `resultado.estadoEfectivo`. */
  estado_obra: EstadoObra;
  inicio: string;
  fin: string;
  resultado: ResultadoResumen;
  curva: PuntoCurvaResumen[] | null;
}

export interface ObraSinEvaluar {
  id_centro_costo: number;
  codigo_obra: string | null;
  centro_costo: string | null;
  faltantes: ('estado_obra' | 'fecha_inicio' | 'fecha_fin_prog')[];
}

export interface Portafolio {
  hoy: string;
  total: number;
  obras: ObraResumen[];
  sin_evaluar: ObraSinEvaluar[];
}

export interface ArbolObra {
  id_centro_costo: number;
  partidas: PartidaResultado[];
  curvaS: CurvaS | null;
}

export interface EventoPortafolio {
  id: number;
  id_centro_costo: number;
  codigo_obra: string | null;
  centro_costo: string | null;
  tipo: string;
  titulo: string;
  detalle: string | null;
  valor_antes: string | null;
  valor_despues: string | null;
  severidad: 'info' | 'good' | 'warn' | 'crit';
  usuario: string | null;
  created_at: string;
}

/** Filtros globales del Dashboard (RF-OP-46): se mantienen al cambiar de vista. */
export interface FiltrosGlobales {
  /** Año de inicio; `null` = todos. */
  anio: number | null;
  /** Con año, suma las vigentes que iniciaron antes. */
  vigentesAnteriores: boolean;
  cliente: number | null;
  jefe: number | null;
  coordinador: number | null;
  departamento: string | null;
  estado: EstadoObra | null;
  q: string;
}

export const SIN_FILTROS: FiltrosGlobales = {
  anio: null,
  vigentesAnteriores: true,
  cliente: null,
  jefe: null,
  coordinador: null,
  departamento: null,
  estado: null,
  q: '',
};

export interface CatalogosPortafolio {
  clientes: PersonaObra[];
  jefes: PersonaObra[];
  coordinadores: PersonaObra[];
  departamentos: string[];
  anios: number[];
}

/** Referencias de carga por persona (RC-20; configurables en el futuro: RF-OP-45). */
export const REFERENCIA_JEFE = 10;
export const REFERENCIA_COORDINADOR = 5;

// ─── Campana de avisos (RF-OP-49) ────────────────────────────────────────────

export const TIPOS_EVENTO = ['ALTA', 'ESTADO', 'AVANCE', 'PLAZO', 'EQUIPO', 'REPROGRAMACION', 'SITUACION', 'VENCIDO', 'SOBRECARGA'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const ETIQUETAS_TIPO_EVENTO: Readonly<Record<TipoEvento, string>> = {
  ALTA: 'Alta de la obra',
  ESTADO: 'Cambio de estado',
  AVANCE: 'Avance reportado',
  PLAZO: 'Cambio de plazo',
  EQUIPO: 'Cambio de equipo',
  REPROGRAMACION: 'Reprogramación',
  SITUACION: 'Cambio de situación',
  VENCIDO: 'Plazo vencido',
  SOBRECARGA: 'Sobrecarga de personal',
};

export interface EstadoAvisos {
  /** Lo anterior a este instante ya se leyó; `null` = nunca marcó como leído. */
  visto_hasta: string | null;
  /** Tipos que cuentan como aviso; `null` = todos. */
  tipos_importantes: string[] | null;
  no_leidos: number;
}
