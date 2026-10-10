export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  id: number;
  nombre: string | null;
}

export const ESTADOS_REQUERIMIENTO = ['BORRADOR', 'ENVIADO', 'OBSERVADO', 'APROBADO', 'RECHAZADO', 'ANULADO'] as const;
export type EstadoRequerimiento = (typeof ESTADOS_REQUERIMIENTO)[number];

export const ESTADO_LABEL: Record<EstadoRequerimiento, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

export type AvanceRequerimiento = 'SIN_ATENDER' | 'PARCIAL' | 'ATENDIDO';

export const AVANCE_LABEL: Record<AvanceRequerimiento, string> = {
  SIN_ATENDER: 'Sin atender',
  PARCIAL: 'Atención parcial',
  ATENDIDO: 'Atendido',
};

export type AccionRequerimiento = 'CREAR' | 'ENVIAR' | 'OBSERVAR' | 'APROBAR' | 'RECHAZAR' | 'ANULAR';

export const ACCION_LABEL: Record<AccionRequerimiento, string> = {
  CREAR: 'Creado',
  ENVIAR: 'Enviado a aprobación',
  OBSERVAR: 'Observado',
  APROBAR: 'Aprobado',
  RECHAZAR: 'Rechazado',
  ANULAR: 'Anulado',
};

export interface RequerimientoLinea {
  id: number;
  id_producto: number;
  codigo: string;
  descripcion: string;
  tipo_producto: 'PRODUCTO' | 'SERVICIO';
  unidad: string;
  cantidad: string;
  cantidad_aprobada: string | null;
  precio_referencial: string | null;
  observaciones: string | null;
  cantidad_ordenada: string;
  saldo_por_ordenar: string;
}

export interface RequerimientoEvento {
  id: number;
  accion: AccionRequerimiento;
  estado_anterior: EstadoRequerimiento | null;
  estado_nuevo: EstadoRequerimiento;
  id_anexo: number | null;
  anexo: string | null;
  comentario: string | null;
  created_at: string;
}

export interface RequerimientoOrdenCompra {
  id: number;
  id_oc: string | null;
  numero_oc: string | null;
  total: string | null;
  fecha_emision: string | null;
}

export interface Requerimiento {
  id: number;
  numero: string;
  fecha: string;
  fecha_requerida: string | null;
  id_centro_costo: number;
  centro_costo: string | null;
  id_fase: number | null;
  fase: string | null;
  id_solicitante: number;
  solicitante: string | null;
  area: string | null;
  justificacion: string;
  estado: EstadoRequerimiento;
  id_aprobador: number | null;
  aprobador: string | null;
  fecha_aprobacion: string | null;
  comentario_aprobacion: string | null;
  avance: AvanceRequerimiento | null;
  created_at: string;
  total_lineas: number;
  lineas?: RequerimientoLinea[];
  eventos?: RequerimientoEvento[];
  ordenes_compra?: RequerimientoOrdenCompra[];
}

export interface RequerimientoLineaPayload {
  id_producto: number;
  cantidad: string;
  precio_referencial?: string;
  observaciones?: string;
}

export interface RequerimientoPayload {
  fecha: string;
  fecha_requerida?: string;
  id_centro_costo: number;
  id_fase?: number;
  id_solicitante: number;
  area?: string;
  justificacion: string;
  lineas: RequerimientoLineaPayload[];
}

export interface RequerimientoQuery {
  page?: number;
  pageSize?: number;
  estado?: EstadoRequerimiento;
  id_centro_costo?: number;
  id_solicitante?: number;
  desde?: string;
  hasta?: string;
  search?: string;
}

export interface AprobarPayload {
  id_aprobador: number;
  comentario?: string;
  lineas?: { id_detalle: number; cantidad_aprobada: string }[];
}

/** Producto o servicio del catálogo, tal como lo devuelve `/maestros/producto`. */
export interface ItemCatalogo {
  id: number;
  codigo: string;
  descripcion: string;
  tipo_producto: 'PRODUCTO' | 'SERVICIO';
}
