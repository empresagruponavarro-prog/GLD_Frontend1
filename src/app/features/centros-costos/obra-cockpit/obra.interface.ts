export interface ObraResidente {
  id: number;
  nombre_completo: string;
  rol_obra: string;
  cip_cap?: string;
  especialidad?: string;
  telefono?: string;
  correo?: string;
  turno?: string;
  estado_planta: string;
  foto_url?: string;
  whatsapp_url?: string;
}

export interface ObraSemana {
  id: number;
  numero_semana: number;
  etiqueta_semana: string;
  fecha_inicio: string;
  fecha_fin: string;
  fase_principal: string;
  responsable_nombre?: string;
  porcentaje_meta: number;
  porcentaje_real: number;
  estado: string; // 'Completado' | 'En Plazo' | 'Retrasado' | 'Programado'
}

export interface ObraPlano {
  id: number;
  codigo_plano: string;
  nombre_plano: string;
  disciplina: string; // 'Arquitectura' | 'Estructuras' | 'Inst. Eléctricas' | 'Inst. Sanitarias' | 'HVAC'
  version: string;
  es_vigente: boolean;
  estado_aprobacion: string;
  formato_peso?: string;
  archivo_url?: string;
  emitido_por?: string;
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

export interface ObraKpi {
  avance_real_global: number;
  avance_meta_global: number;
  desviacion: number;
  semana_activa: number;
  semanas_totales: number;
  personal_activo: number;
}

export interface ObraCockpit {
  id_centro_costo: number;
  nombre_obra: string;
  generales?: ObraDatosGenerales;
  kpis: ObraKpi;
  cronograma: ObraSemana[];
  residentes: ObraResidente[];
  planos: ObraPlano[];
}

export interface UpdateGeneralesPayload {
  expediente_codigo?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ubigeo_cod?: string;
  latitud?: number;
  longitud?: number;
  semanas_totales?: number;
  personal_activo_promedio?: number;
  turno_trabajo?: string;
  contacto_cliente_nombre?: string;
  contacto_cliente_telefono?: string;
  contacto_cliente_correo?: string;
}

export interface UpdateAvancePayload {
  porcentaje_real: number;
  estado?: string;
}

export interface CreateResidentePayload {
  nombre_completo: string;
  rol_obra: string;
  cip_cap?: string;
  especialidad?: string;
  telefono?: string;
  correo?: string;
  turno?: string;
  estado_planta?: string;
  orden?: number;
}
