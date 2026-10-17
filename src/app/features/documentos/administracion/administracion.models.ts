import { Paginated } from '../../requerimientos/requerimientos.models';

export type { Paginated };

export const CLASES_DOCUMENTO = [
  'ORDEN_COMPRA',
  'ORDEN_SERVICIO',
  'PLANILLA_PERSONAL',
  'PLANILLA_OBRA',
  'CAJA_CHICA',
  'GASTO_FINANCIERO',
  'PAGO_SERVICIO',
  'OTRO',
] as const;
export type ClaseDocumento = (typeof CLASES_DOCUMENTO)[number];

export const CLASE_LABEL: Record<ClaseDocumento, string> = {
  ORDEN_COMPRA: 'Orden de compra',
  ORDEN_SERVICIO: 'Orden de servicio',
  PLANILLA_PERSONAL: 'Planilla de personal',
  PLANILLA_OBRA: 'Planilla de obra',
  CAJA_CHICA: 'Caja chica',
  GASTO_FINANCIERO: 'Gasto financiero',
  PAGO_SERVICIO: 'Pago de servicios',
  OTRO: 'Otro',
};

/** Clases que se registran directamente (sin líneas ni cotizaciones). */
export const CLASES_DIRECTAS: readonly ClaseDocumento[] = CLASES_DOCUMENTO.filter((c) => c !== 'ORDEN_COMPRA' && c !== 'ORDEN_SERVICIO');

/** Estado del documento de origen (vigente o anulado). */
export const ESTADOS_DOCUMENTO = ['REGISTRADO', 'ANULADO'] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export type EstadoPago = 'SIN_PROGRAMAR' | 'PROGRAMADO' | 'PARCIAL' | 'PAGADO' | 'ANULADO';

export const ESTADOS_PAGO: readonly EstadoPago[] = ['SIN_PROGRAMAR', 'PROGRAMADO', 'PARCIAL', 'PAGADO', 'ANULADO'];

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  SIN_PROGRAMAR: 'Sin programar',
  PROGRAMADO: 'Programado',
  PARCIAL: 'Pago parcial',
  PAGADO: 'Pagado',
  ANULADO: 'Anulado',
};

export function estadoPagoBadge(estado: string): string {
  switch (estado) {
    case 'PAGADO':
      return 'badge-completed';
    case 'PARCIAL':
    case 'PROGRAMADO':
      return 'badge-pending';
    case 'ANULADO':
      return 'badge-danger';
    default:
      return 'badge-progress';
  }
}

export interface DocumentoAdmin {
  id: number;
  numero_documento: string | null;
  numero_oc: string | null;
  clase_documento: ClaseDocumento | null;
  estado: 'REGISTRADO' | 'ANULADO';
  id_anexo: number | null;
  proveedor: string | null;
  ruc: string | null;
  id_centro_costo: number | null;
  centro_costo: string | null;
  id_centro_costos_principal: number | null;
  centro_costo_principal: string | null;
  id_area: number | null;
  area_nombre: string | null;
  id_requerimiento: number | null;
  numero_requerimiento: string | null;
  fecha_emision: string | null;
  forma_pago: string | null;
  moneda_id: string | null;
  moneda_simbolo: string | null;
  afecto_igv: boolean;
  monto: string;
  igv: string;
  total: string;
  renta_4ta: string;
  dscto_compras: string;
  dscto_intervencion: string;
  dscto_otros: string;
  detraccion_porcentaje: string | null;
  detraccion_monto: string | null;
  retencion_porcentaje: string | null;
  retencion_monto: string | null;
  retencion_manual: boolean;
  comentarios: string | null;
  dias_credito: number | null;
  fecha_vencimiento_manual: string | null;
  ultima_recepcion: string | null;
  vencimiento: string | null;
  pendiente_recepcion: boolean;
  neto_proveedor: string;
  pagado_proveedor: string;
  pagado_detraccion: string;
  programado_proveedor: string;
  programado_detraccion: string;
  saldo_por_pagar_proveedor: string;
  saldo_por_pagar_detraccion: string;
  fecha_ultimo_pago: string | null;
  estado_pago: EstadoPago;
}

export interface DocumentoLinea {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  tipo_producto: string | null;
  cantidad: string;
  precio: string;
  monto: string;
  id_requerimiento_detalle: number | null;
}

export interface DocumentoProgramacion {
  id: number;
  concepto: 'PROVEEDOR' | 'DETRACCION';
  fecha_programada: string;
  urgente: boolean;
  monto: string;
  medio_pago: string;
  id_cuenta: number | null;
  cuenta: string | null;
  cuenta_destino: string | null;
  estado: 'PROGRAMADO' | 'EJECUTADO' | 'CANCELADO';
  observaciones: string | null;
}

export interface DocumentoPago {
  id: number;
  numero: string;
  concepto: 'PROVEEDOR' | 'DETRACCION';
  fecha_pago: string;
  monto: string;
  medio_pago: string;
  cuenta: string | null;
  numero_operacion: string | null;
  estado: 'REGISTRADO' | 'ANULADO';
}

export interface DocumentoDetalle extends DocumentoAdmin {
  lineas: DocumentoLinea[];
  programaciones: DocumentoProgramacion[];
  pagos: DocumentoPago[];
  retencion_motivo: string;
}

export interface DocumentoQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  clase_documento?: ClaseDocumento;
  estado?: 'REGISTRADO' | 'ANULADO';
  estado_pago?: EstadoPago;
  monto_min?: number;
  monto_max?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  vence_desde?: string;
  vence_hasta?: string;
  id_centro_costo?: number;
  id_centro_costos_principal?: number;
  id_area?: number;
  id_anexo?: number;
  id_requerimiento?: number;
}

export interface DocumentoDirectoPayload {
  clase_documento: ClaseDocumento;
  id_anexo: number;
  concepto: string;
  monto: string;
  fecha_emision: string;
  afecto_igv?: boolean;
  id_centro_costo?: number;
  id_fase?: number;
  id_area?: number;
  moneda_id?: string;
  moneda_simbolo?: string;
  forma_pago?: string;
  dias_credito?: number;
  fecha_vencimiento?: string;
  detraccion_porcentaje?: number;
  retencion_monto?: number;
  renta_4ta?: number;
  dscto_compras?: number;
  dscto_intervencion?: number;
  dscto_otros?: number;
}

export interface DeduccionesPayload {
  renta_4ta?: number;
  dscto_compras?: number;
  dscto_intervencion?: number;
  dscto_otros?: number;
  detraccion_porcentaje?: number;
  /** `null` vuelve al cálculo automático de la retención. */
  retencion_monto?: number | null;
  afecto_igv?: boolean;
  dias_credito?: number;
  fecha_vencimiento?: string;
  id_area?: number;
}
