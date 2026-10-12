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

export const ESTADOS_REQUERIMIENTO = ['BORRADOR', 'ENVIADO', 'COTIZADO', 'OBSERVADO', 'APROBADO', 'RECHAZADO', 'ANULADO'] as const;
export type EstadoRequerimiento = (typeof ESTADOS_REQUERIMIENTO)[number];

export const ESTADO_LABEL: Record<EstadoRequerimiento, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  COTIZADO: 'Cotizado',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

export const TIPOS_REQUERIMIENTO = [
  'COMPRA',
  'PLANILLA_PERSONAL',
  'PLANILLA_OBRA',
  'CAJA_CHICA',
  'GASTO_FINANCIERO',
  'PAGO_SERVICIO',
  'OTRO',
] as const;
export type TipoRequerimiento = (typeof TIPOS_REQUERIMIENTO)[number];

export const TIPO_LABEL: Record<TipoRequerimiento, string> = {
  COMPRA: 'Compra de bienes o servicios',
  PLANILLA_PERSONAL: 'Planilla de personal',
  PLANILLA_OBRA: 'Planilla de obra',
  CAJA_CHICA: 'Caja chica (reembolso)',
  GASTO_FINANCIERO: 'Gasto financiero',
  PAGO_SERVICIO: 'Pago de servicios',
  OTRO: 'Otro',
};

export type AvanceRequerimiento = 'SIN_ATENDER' | 'PARCIAL' | 'ATENDIDO';

export const AVANCE_LABEL: Record<AvanceRequerimiento, string> = {
  SIN_ATENDER: 'Sin atender',
  PARCIAL: 'Atención parcial',
  ATENDIDO: 'Atendido',
};

export type AccionRequerimiento =
  | 'CREAR'
  | 'ENVIAR'
  | 'CERRAR_COTIZACION'
  | 'REABRIR_COTIZACION'
  | 'OBSERVAR'
  | 'APROBAR'
  | 'RECHAZAR'
  | 'ANULAR';

export const ACCION_LABEL: Record<AccionRequerimiento, string> = {
  CREAR: 'Creado',
  ENVIAR: 'Enviado a aprobación',
  CERRAR_COTIZACION: 'Cuadro comparativo cerrado',
  REABRIR_COTIZACION: 'Cotizaciones reabiertas',
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
  id_beneficiario: number | null;
  beneficiario: string | null;
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

/** Documento de origen vinculado (OC, OS, planilla…). */
export interface RequerimientoOrdenCompra {
  id: number;
  id_oc: string | null;
  numero_oc: string | null;
  total: string | null;
  fecha_emision: string | null;
  numero_documento: string | null;
  clase_documento: string | null;
  estado: string | null;
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
  tipo: TipoRequerimiento;
  id_beneficiario: number | null;
  beneficiario: string | null;
  id_area: number | null;
  area_nombre: string | null;
  id_cotizacion_ganadora: number | null;
  comentario_adjudicacion: string | null;
  total_cotizaciones: number;
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
  id_beneficiario?: number;
}

export interface RequerimientoPayload {
  fecha: string;
  fecha_requerida?: string;
  id_centro_costo: number;
  id_fase?: number;
  id_solicitante: number;
  area?: string;
  tipo?: TipoRequerimiento;
  id_beneficiario?: number;
  id_area?: number;
  justificacion: string;
  lineas: RequerimientoLineaPayload[];
}

export interface RequerimientoQuery {
  page?: number;
  pageSize?: number;
  estado?: EstadoRequerimiento;
  tipo?: TipoRequerimiento;
  id_area?: number;
  id_centro_costo?: number;
  id_solicitante?: number;
  desde?: string;
  hasta?: string;
  search?: string;
}

export interface AprobarPayload {
  id_aprobador: number;
  comentario?: string;
  /** Compras: la cotización elegida. El sistema no exige que sea la más barata. */
  id_cotizacion_ganadora?: number;
  comentario_adjudicacion?: string;
  lineas?: { id_detalle: number; cantidad_aprobada: string }[];
}

/** Producto o servicio del catálogo, tal como lo devuelve `/maestros/producto`. */
export interface ItemCatalogo {
  id: number;
  codigo: string;
  descripcion: string;
  tipo_producto: 'PRODUCTO' | 'SERVICIO';
}

// ------------------------------------------------------------- cotizaciones

export const MEDIOS_PAGO = ['EFECTIVO', 'CHEQUE', 'TRANSFERENCIA', 'DEPOSITO', 'YAPE', 'PLIN', 'OTRO'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  YAPE: 'Yape',
  PLIN: 'Plin',
  OTRO: 'Otro',
};

export interface CotizacionLinea {
  id: number;
  id_requerimiento_detalle: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cotiza: boolean;
  cantidad: string;
  precio_unitario: string;
  precio_sin_igv: string;
  precio_con_igv: string;
  subtotal_sin_igv: string;
  plazo_entrega_dias: number | null;
  marca_modelo: string | null;
  observaciones: string | null;
}

export interface Cotizacion {
  id: number;
  numero: string;
  id_requerimiento: number;
  id_proveedor: number;
  proveedor: string | null;
  fecha: string;
  referencia: string | null;
  moneda_id: string;
  moneda_simbolo: string | null;
  incluye_igv: boolean;
  afecto_igv: boolean;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje: string | null;
  medio_pago: MedioPago | null;
  plazo_entrega_dias: number | null;
  validez_dias: number | null;
  garantia: string | null;
  condiciones: string | null;
  archivo_url: string | null;
  total_sin_igv: string;
  igv: string;
  total: string;
  es_ganadora: boolean;
  lineas: CotizacionLinea[];
}

export interface CotizacionLineaPayload {
  id_requerimiento_detalle: number;
  cotiza: boolean;
  cantidad: string;
  precio_unitario: string;
  plazo_entrega_dias?: number;
  marca_modelo?: string;
  observaciones?: string;
}

export interface CotizacionPayload {
  id_proveedor: number;
  fecha: string;
  referencia?: string;
  moneda_id: string;
  moneda_simbolo?: string;
  incluye_igv: boolean;
  afecto_igv: boolean;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje?: string;
  medio_pago?: MedioPago;
  plazo_entrega_dias?: number;
  validez_dias?: number;
  garantia?: string;
  condiciones?: string;
  archivo_url?: string;
  lineas: CotizacionLineaPayload[];
}

export interface CuadroOferta {
  id_cotizacion: number;
  cotiza: boolean;
  cantidad: string;
  precio_sin_igv: string;
  precio_con_igv: string;
  subtotal_sin_igv: string;
  plazo_entrega_dias: number | null;
}

export interface CuadroLinea {
  id_detalle: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  ofertas: CuadroOferta[];
}

export interface CuadroProveedor {
  id_cotizacion: number;
  numero: string;
  id_proveedor: number;
  proveedor: string | null;
  moneda_id: string;
  moneda_simbolo: string | null;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje: string | null;
  medio_pago: MedioPago | null;
  plazo_entrega_dias: number | null;
  validez_dias: number | null;
  garantia: string | null;
  condiciones: string | null;
  afecto_igv: boolean;
  incluye_igv: boolean;
  total_sin_igv: string;
  igv: string;
  total: string;
  total_soles: string | null;
  tc_usado: string | null;
  es_ganadora: boolean;
}

export interface CuadroComparativo {
  id_requerimiento: number;
  numero: string;
  estado: EstadoRequerimiento;
  tipo: TipoRequerimiento;
  id_cotizacion_ganadora: number | null;
  comentario_adjudicacion: string | null;
  lineas: CuadroLinea[];
  proveedores: CuadroProveedor[];
}

export interface Area {
  id: number;
  codigo: string;
  nombre: string;
  estado: boolean;
}
