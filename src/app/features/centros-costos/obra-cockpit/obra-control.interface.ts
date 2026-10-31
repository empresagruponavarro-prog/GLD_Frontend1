// ─── Control de avance de obra (Dashboard de Operaciones) ────────────────────
// Espejo de lo que devuelve la API `operaciones/obra/:id/*` (backend: `operaciones-obra/`).

export const ESTADOS_OBRA = ['PROXIMO', 'EN_EJECUCION', 'POST_VENTA', 'CULMINADO', 'SUSPENDIDA', 'CANCELADA'] as const;
export type EstadoObra = (typeof ESTADOS_OBRA)[number];

export const ETIQUETAS_ESTADO_OBRA: Readonly<Record<EstadoObra, string>> = {
  PROXIMO: 'Próximo proyecto',
  EN_EJECUCION: 'En ejecución',
  POST_VENTA: 'Post venta',
  CULMINADO: 'Culminado',
  SUSPENDIDA: 'Suspendida',
  CANCELADA: 'Cancelada',
};

/** Mismas transiciones que el backend (`estado.handler.ts`); `NINGUNO` = la obra aún no entra al control. */
export const TRANSICIONES_ESTADO_OBRA: Readonly<Record<EstadoObra | 'NINGUNO', readonly EstadoObra[]>> = {
  NINGUNO: ['PROXIMO', 'EN_EJECUCION'],
  PROXIMO: ['EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA'],
  EN_EJECUCION: ['POST_VENTA', 'SUSPENDIDA', 'CANCELADA'],
  POST_VENTA: ['CULMINADO'],
  SUSPENDIDA: ['PROXIMO', 'EN_EJECUCION', 'CANCELADA'],
  CULMINADO: [],
  CANCELADA: [],
};

export const MOTIVOS_REPROGRAMACION = ['CLIENTE', 'PERMISO_LICENCIA', 'PROVEEDOR_CLIENTE', 'FUERZA_MAYOR', 'INTERNO'] as const;
export type MotivoReprogramacion = (typeof MOTIVOS_REPROGRAMACION)[number];

export const ETIQUETAS_MOTIVO: Readonly<Record<MotivoReprogramacion, string>> = {
  CLIENTE: 'Cliente',
  PERMISO_LICENCIA: 'Permiso / licencia',
  PROVEEDOR_CLIENTE: 'Proveedor del cliente',
  FUERZA_MAYOR: 'Fuerza mayor',
  INTERNO: 'Interno (es atraso)',
};

export type TipoPartida = 'CONTRACTUAL' | 'ADICIONAL';
export const SEMANAS_META = 10;
export const SEMANAS_AVANCE = 16;

export type ClaveSituacion = 'good' | 'warn' | 'crit' | 'neutral' | 'rp';
export interface Situacion {
  clave: ClaveSituacion;
  texto: string;
}

export interface PersonaObra {
  id: number;
  nombre: string;
}
export interface EquipoObra {
  jefe_proyecto: PersonaObra | null;
  coordinador: PersonaObra | null;
  residente: PersonaObra | null;
  resp_presupuesto: PersonaObra | null;
  resp_procura: PersonaObra | null;
}

// ── Estructura (GET partidas) ──
export interface ObraSubpartida {
  id: number;
  id_partida: number;
  item: string;
  nombre: string;
  /** Tipo efectivo (el propio o el de su partida). */
  tipo: TipoPartida;
  tipo_propio: TipoPartida | null;
  fecha_inicio: string;
  fecha_fin: string;
  orden: number;
  observacion: string | null;
  id_ppto_detalle_categoria: number | null;
  /** Diez posiciones (semanas 1-10); null = reparto automático. */
  metas_manuales: (number | null)[];
  tiene_avance: boolean;
}
export interface ObraPartida {
  id: number;
  item: string;
  nombre: string;
  tipo: TipoPartida;
  orden: number;
  id_ppto_detalle_fase: number | null;
  subpartidas: ObraSubpartida[];
}
export interface PartidaPayload {
  item: string;
  nombre: string;
  tipo?: TipoPartida;
}
export interface SubpartidaPayload {
  item: string;
  nombre: string;
  tipo?: TipoPartida | null;
  fecha_inicio: string;
  fecha_fin: string;
  observacion?: string | null;
}
export interface PresupuestoDisponible {
  id: number;
  id_presupuesto: string | null;
  version: string | null;
  tipo: string | null;
  estado: string | null;
  proyecto: string | null;
  fases: number;
  categorias: number;
}
export interface ResultadoImportacion {
  id_presupuesto: number;
  partidas: number;
  subpartidas: number;
  estructura: ObraPartida[];
}

// ── Avance semanal (GET avance) ──
export interface SemanaCalendario {
  numero: number;
  desde: string;
  hasta: string;
  futura: boolean;
  en_curso: boolean;
}
export interface AvanceSubpartida {
  id: number;
  item: string;
  partida_item: string;
  partida_nombre: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  /** Meta efectiva de cada semana (1-10). */
  metas: number[];
  /** Avance de cada semana (1-16); null = sin reportar. */
  avance: (number | null)[];
  real_acumulado: number;
}
export interface AvanceObra {
  hoy: string;
  inicio_semana_1: string;
  semana_en_curso: number;
  semanas: SemanaCalendario[];
  subpartidas: AvanceSubpartida[];
}
export interface LineaAvance {
  idSubpartida: number;
  avance: number | null;
}
export interface ResultadoGuardarAvance {
  semana: number;
  lineas: number;
  real_antes: number | null;
  real_despues: number | null;
}

// ── Reprogramaciones ──
export interface ObraReprogramacion {
  id: number;
  desde: string;
  dias: number;
  motivo: MotivoReprogramacion;
  detalle: string | null;
  es_atraso: boolean;
  registrado_por: string | null;
}
export interface ReprogramacionPayload {
  desde: string;
  dias: number;
  motivo: MotivoReprogramacion;
  detalle?: string | null;
}

// ── Resultado del motor (GET control) ──
export interface MetricasItem {
  real: number;
  programado: number;
  programadoFinSemana: number;
  desviacion: number;
  situacion: Situacion;
}
export interface SubpartidaResultado extends MetricasItem {
  item: string;
  nombre: string;
  tipo: TipoPartida;
  inicio: string;
  fin: string;
  peso: number;
  diasLaborables: number;
  metas: number[];
  sinAvance: boolean;
  estadoCronograma: Situacion;
}
export interface PartidaResultado extends MetricasItem {
  item: string;
  nombre: string;
  tipo: TipoPartida;
  inicio: string;
  fin: string;
  peso: number;
  subpartidas: SubpartidaResultado[];
}
export interface PuntoCurvaS {
  semana: number;
  desde: string;
  hasta: string;
  pactado: number;
  pactadoOriginal: number;
  real: number | null;
  diasPausa: number;
  semanaEnPausa: boolean;
  enCurso: boolean;
}
export interface CurvaS {
  inicioSemana1: string;
  semanas: PuntoCurvaS[];
  semanaCorte: number;
  excede: boolean;
}
export interface PlazosObra {
  finOriginal: string;
  finVigente: string;
  finControl: string;
  diasReprogramados: number;
  diasExternos: number;
  diasInternos: number;
  enPausa: boolean;
  diasFueraDePlazo: number;
  diasRetraso: number;
  proximoAVencer: boolean;
}
export interface PostVentaInfo {
  inicio: string;
  cierre: string | null;
  dias: number;
  texto: string;
  cerrada: boolean;
}
export interface AvisoCarga {
  codigo: string;
  ambito: 'obra' | 'subpartida';
  item?: string;
  mensaje: string;
}
export interface ResultadoObra extends MetricasItem {
  estadoEfectivo: EstadoObra;
  sinPartidas: boolean;
  sinAvance: boolean;
  semana: { actual: number; total: number; texto: string; tarde: boolean };
  plazos: PlazosObra;
  postVenta: PostVentaInfo | null;
  corte: string;
  partidas: PartidaResultado[];
  curvaS: CurvaS | null;
  adicionales: { subpartidas: number; avance: number; pesoPct: number } | null;
  avisos: AvisoCarga[];
}
export interface ControlObra {
  id_centro_costo: number;
  hoy: string;
  configurada: boolean;
  faltantes: ('estado_obra' | 'fecha_inicio' | 'fecha_fin_prog')[];
  estado_obra: EstadoObra | null;
  ficha: { codigo_obra: string | null; tienda: string | null; departamento: string | null; comentario: string | null; equipo: EquipoObra };
  resultado: ResultadoObra | null;
}
export interface ObraEvento {
  id: number;
  tipo: string;
  titulo: string;
  detalle: string | null;
  valor_antes: string | null;
  valor_despues: string | null;
  severidad: 'info' | 'good' | 'warn' | 'crit';
  usuario: string | null;
  created_at: string;
}
export interface CambiarEstadoPayload {
  estado: EstadoObra;
  fecha?: string;
  observaciones?: string;
  confirmar?: boolean;
}
export interface CambioEstado {
  anterior: EstadoObra | null;
  estado: EstadoObra;
  fecha: string;
  avisos: string[];
}

// ── Importación del Excel por proyecto (RF-OP-52) ──
export interface MensajeImportacion {
  /** `Ficha f. 4`, `Partidas f. 12`… */
  fila: string;
  nombre?: string;
  mensaje: string;
}
export interface EquipoImportacion {
  rol: 'jefe_proyecto' | 'coordinador' | 'residente' | 'resp_presupuesto' | 'resp_procura';
  /** Lo que dice el archivo. */
  texto: string;
  /** Trabajador del maestro al que corresponde; `null` si no se encontró o es ambiguo. */
  persona: PersonaObra | null;
}
export interface ResumenImportacion {
  partidas: number;
  subpartidas: number;
  subpartidas_con_avance: number;
  metas_manuales: number;
  reprogramaciones: number;
}
export interface VistaPreviaExcel {
  archivo: string;
  importable: boolean;
  ficha: {
    codigo: string;
    cliente: string;
    tienda: string;
    departamento: string;
    estado: EstadoObra | null;
    inicio: string | null;
    fin: string | null;
  };
  resumen: ResumenImportacion;
  equipo: EquipoImportacion[];
  obra_actual: { codigo_obra: string | null; estado_obra: string | null; partidas: number; subpartidas: number; con_avance: boolean; reprogramaciones: number };
  reemplaza_estructura: boolean;
  errores: MensajeImportacion[];
  avisos: MensajeImportacion[];
}
export interface ResultadoImportacionExcel {
  importado: boolean;
  resumen: ResumenImportacion;
  avisos: MensajeImportacion[];
}
