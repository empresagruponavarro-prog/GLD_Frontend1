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

export type ObraTab = 'cronograma' | 'directorio' | 'planos' | 'documentos' | 'incidencias';

// ─── Modelos de respuesta ────────────────────────────────────────────────────
export interface ObraResidente {
  id: number;
  id_anexo?: number;
  nombre_completo: string;
  rol_obra: string;
  cip_cap?: string;
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
export type UpdateGeneralesPayload = Partial<Omit<ObraDatosGenerales, 'id' | 'google_maps_url' | 'waze_url'>>;

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

export interface IncidenciaPayload {
  titulo: string;
  descripcion: string;
  prioridad?: string;
  responsable?: string;
  accion_solicitada_o_ejecutada?: string;
  plazo_resolucion?: string;
  estado?: string;
}

export interface DeleteResult {
  deleted: boolean;
  id: number;
}
