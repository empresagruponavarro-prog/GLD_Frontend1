import type { EquipoObra, EstadoObra } from './obra-control.interface';

// ─── Catálogos (deben coincidir con las validaciones del backend) ────────────
export const ESTADOS_SEMANA = ['Programado', 'En Plazo', 'Retrasado', 'Completado'] as const;
export const ESTADOS_PLANTA = ['En Planta', 'Fuera de Planta', 'Vacaciones', 'Retirado'] as const;
export const DISCIPLINAS_PLANO = ['Arquitectura', 'Estructuras', 'Eléctricas', 'Sanitarias', 'Mecánicas', 'Comunicaciones', 'Otros'] as const;
export const ESTADOS_APROBACION_PLANO = ['Aprobado Obra', 'En Revisión', 'Observado', 'Para Construcción'] as const;
export const CATEGORIAS_DOCUMENTO = ['Acta', 'Permiso', 'Seguridad', 'Calidad', 'Contrato', 'Otros'] as const;
export const ESTADOS_DOCUMENTO = ['Validado', 'Pendiente', 'Observado', 'Vencido'] as const;
export const PRIORIDADES_INCIDENCIA = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export const ESTADOS_INCIDENCIA = ['PENDIENTE', 'EN PROCESO', 'RESUELTA'] as const;

export type EstadoSemana = (typeof ESTADOS_SEMANA)[number];
export type PrioridadIncidencia = (typeof PRIORIDADES_INCIDENCIA)[number];
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];

export type ObraTab = 'cronograma' | 'control' | 'directorio' | 'planos' | 'documentos' | 'incidencias';

// ─── Modelos de respuesta ────────────────────────────────────────────────────
export interface ObraResidente {
  id: number;
  id_anexo?: number;
  nombre_completo: string;
  rol_obra: string;
  especialidad?: string;
  telefono?: string;
  correo?: string;
  turno?: string;
  estado_planta: string;
  foto_url?: string;
  orden: number;
  whatsapp_url?: string;
}

export interface ObraSemana {
  id: number;
  numero_semana: number;
  etiqueta_semana: string;
  fecha_inicio: string;
  fecha_fin: string;
  fase_principal: string;
  descripcion_actividades?: string;
  responsable_nombre?: string;
  /** % acumulado programado al cierre de la semana (Curva S) */
  porcentaje_meta: number;
  /** % acumulado real al cierre de la semana (Curva S) */
  porcentaje_real: number;
  estado: string;
  orden: number;
}

export interface ObraPlano {
  id: number;
  codigo_plano: string;
  nombre_plano: string;
  disciplina: string;
  version: string;
  es_vigente: boolean;
  id_plano_anterior?: number;
  estado_aprobacion: string;
  fecha_vobo?: string;
  formato_peso?: string;
  archivo_url?: string;
  emitido_por?: string;
  created_at: string;
}

export interface ObraDocumento {
  id: number;
  titulo: string;
  subtitulo?: string;
  categoria: string;
  nro_registro?: string;
  fecha_emision?: string;
  vigencia_texto?: string;
  estado: string;
  archivo_url?: string;
  created_at: string;
}

export interface ObraIncidencia {
  id: number;
  codigo_incidencia: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  responsable?: string;
  accion_solicitada_o_ejecutada?: string;
  plazo_resolucion?: string;
  estado: string;
  fecha_reporte: string;
  fecha_resolucion?: string;
  /** Subpartida a la que se atribuye (motivo del retraso). */
  id_subpartida?: number;
}

export interface ObraDatosGenerales {
  id: number;
  expediente_codigo?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ubigeo_cod?: string;
  latitud?: number;
  longitud?: number;
  google_maps_url?: string;
  waze_url?: string;
  semanas_totales?: number;
  personal_activo_promedio?: number;
  turno_trabajo?: string;
  contacto_cliente_nombre?: string;
  contacto_cliente_telefono?: string;
  contacto_cliente_correo?: string;
  // ── Ficha operativa (Dashboard de Operaciones) ──
  codigo_obra?: string;
  tienda?: string;
  /** Ausente = la obra no participa del control de avance. */
  estado_obra?: EstadoObra;
  comentario?: string;
  avance_general?: number;
  fecha_cierre_postventa?: string;
  plazo_postventa_dias?: number;
  observaciones_postventa?: string;
  id_presupuesto_origen?: number;
  equipo?: EquipoObra;
}

export interface ObraCabecera {
  estado?: string;
  fecha_inicio?: string;
  fecha_fin_prog?: string;
  fecha_fin_real?: string;
  empresa?: string;
  cliente?: string;
  cod_cliente?: string;
}

export interface ObraKpi {
  avance_real_global: number;
  avance_meta_global: number;
  desviacion: number;
  semana_activa: number;
  semanas_totales: number;
  personal_activo: number;
  dias_totales: number;
  dias_transcurridos: number;
  semanas_retrasadas: number;
  incidencias_pendientes: number;
}

export interface ObraCockpit {
  id_centro_costo: number;
  nombre_obra: string;
  cabecera: ObraCabecera;
  generales?: ObraDatosGenerales;
  kpis: ObraKpi;
  cronograma: ObraSemana[];
  residentes: ObraResidente[];
  planos: ObraPlano[];
  documentos: ObraDocumento[];
  incidencias: ObraIncidencia[];
}

// ─── Payloads ────────────────────────────────────────────────────────────────
type CamposSoloLectura = 'id' | 'google_maps_url' | 'waze_url' | 'estado_obra' | 'equipo' | 'id_presupuesto_origen' | 'fecha_cierre_postventa';
type CamposLimpiablesFicha = 'avance_general' | 'comentario' | 'plazo_postventa_dias' | 'observaciones_postventa';

/** La ficha: los campos limpiables aceptan `null`; el estado se cambia con `POST …/estado`. */
export type UpdateGeneralesPayload = Partial<Omit<ObraDatosGenerales, CamposSoloLectura | CamposLimpiablesFicha>> &
  Partial<{ [K in CamposLimpiablesFicha]: ObraDatosGenerales[K] | null }> & {
    id_jefe_proyecto?: number | null;
    id_coordinador?: number | null;
    id_residente?: number | null;
    id_resp_presupuesto?: number | null;
    id_resp_procura?: number | null;
    /** Inicio y fin programado: se guardan en el centro de costo. */
    fecha_inicio?: string;
    fecha_fin_prog?: string;
  };

export interface SemanaPayload {
  numero_semana?: number;
  etiqueta_semana?: string;
  fecha_inicio: string;
  fecha_fin: string;
  fase_principal: string;
  descripcion_actividades?: string;
  responsable_nombre?: string;
  porcentaje_meta?: number;
  porcentaje_real?: number;
  estado?: string;
}

export interface UpdateAvancePayload {
  porcentaje_real: number;
  estado?: string;
}

export type ResidentePayload = Partial<Omit<ObraResidente, 'id' | 'whatsapp_url' | 'foto_url'>> &
  Pick<ObraResidente, 'nombre_completo' | 'rol_obra'>;

export interface PlanoPayload {
  codigo_plano: string;
  nombre_plano: string;
  disciplina: string;
  version?: string;
  estado_aprobacion?: string;
  fecha_vobo?: string;
  formato_peso?: string;
  archivo_url?: string;
  emitido_por?: string;
}

export type NuevaVersionPlanoPayload = Partial<Omit<PlanoPayload, 'codigo_plano' | 'disciplina'>>;

/** Respuesta de POST /planos/archivo */
export interface ArchivoPlano {
  archivo_url: string;
  formato_peso: string;
  nombre_original: string;
  bytes: number;
}

export const PLANO_EXTENSIONES = ['.pdf', '.dwg', '.dxf', '.rvt', '.ifc', '.zip'] as const;
export const PLANO_MAX_BYTES = 50 * 1024 * 1024;

export interface DocumentoPayload {
  titulo: string;
  subtitulo?: string;
  categoria: string;
  nro_registro?: string;
  fecha_emision?: string;
  vigencia_texto?: string;
  estado?: string;
  archivo_url?: string;
}

/** Respuesta de POST /documentos/archivo */
export interface ArchivoDocumento {
  archivo_url: string;
  nombre_original: string;
  bytes: number;
}

export const DOCUMENTO_EXTENSIONES = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.zip'] as const;
export const DOCUMENTO_MAX_BYTES = 50 * 1024 * 1024;

/** Campos opcionales que el PATCH permite limpiar enviando null. */
type CamposLimpiablesDocumento = 'subtitulo' | 'nro_registro' | 'fecha_emision' | 'vigencia_texto' | 'archivo_url';

/** Payload de actualización: los opcionales aceptan null (limpiar) y undefined (no tocar). */
export type DocumentoPatch = Partial<Omit<DocumentoPayload, CamposLimpiablesDocumento>> &
  Partial<Record<CamposLimpiablesDocumento, string | null>>;

export interface IncidenciaPayload {
  titulo: string;
  descripcion: string;
  prioridad?: string;
  responsable?: string;
  accion_solicitada_o_ejecutada?: string;
  plazo_resolucion?: string;
  estado?: string;
  id_subpartida?: number | null;
}

export interface DeleteResult {
  deleted: boolean;
  id: number;
}
