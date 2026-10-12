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

/** Medios que dejan número de operación, cheque o constancia. */
export const MEDIOS_CON_OPERACION: readonly MedioPago[] = ['CHEQUE', 'TRANSFERENCIA', 'DEPOSITO', 'YAPE', 'PLIN'];

export const TIPOS_CUENTA = ['CAJA', 'BANCO', 'BILLETERA'] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];

export type Concepto = 'PROVEEDOR' | 'DETRACCION';

export interface Cuenta {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  banco: string | null;
  numero_cuenta: string | null;
  cci: string | null;
  moneda_id: string;
  id_empresa: number | null;
  estado: boolean;
}

export interface CuentaPayload {
  codigo?: string;
  nombre: string;
  tipo?: TipoCuenta;
  banco?: string;
  numero_cuenta?: string;
  cci?: string;
  moneda_id?: string;
  estado?: boolean;
}

export interface TipoCambio {
  id: number;
  fecha: string;
  moneda_id: string;
  compra: string;
  venta: string;
}

export interface TipoCambioVigente {
  fecha: string;
  compra: string;
  venta: string;
  exacto: boolean;
}

export interface ProgramacionItemPayload {
  id_documento_origen: number;
  concepto?: Concepto;
  fecha_programada: string;
  monto: string;
  medio_pago: MedioPago;
  id_cuenta?: number;
  cuenta_destino?: string;
  urgente?: boolean;
  observaciones?: string;
}

export interface Programacion {
  id: number;
  id_documento_origen: number;
  numero_documento: string | null;
  clase_documento: string | null;
  proveedor: string | null;
  centro_costo: string | null;
  moneda_id: string | null;
  moneda_simbolo: string | null;
  concepto: Concepto;
  fecha_programada: string;
  urgente: boolean;
  monto: string;
  monto_soles: string;
  medio_pago: MedioPago;
  id_cuenta: number | null;
  cuenta: string | null;
  cuenta_destino: string | null;
  estado: 'PROGRAMADO' | 'EJECUTADO' | 'CANCELADO';
  observaciones: string | null;
}

export interface AgendaFecha {
  fecha: string;
  cantidad: number;
  total_soles: string;
  por_cuenta: { cuenta: string; total_soles: string }[];
}

export interface Agenda {
  items: Programacion[];
  sin_tipo_cambio: number;
  totales_por_fecha: AgendaFecha[];
}

export interface EjecutarPagoPayload {
  id_pago_programado: number;
  fecha_pago: string;
  monto?: string;
  id_cuenta: number;
  medio_pago?: MedioPago;
  numero_operacion?: string;
  tipo_cambio?: string;
  id_ejecutado_por?: number;
  observaciones?: string;
}

export interface PagoDirectoPayload {
  id_documento_origen: number;
  concepto?: Concepto;
  fecha_pago: string;
  monto: string;
  medio_pago: MedioPago;
  id_cuenta: number;
  cuenta_destino?: string;
  numero_operacion?: string;
  tipo_cambio?: string;
  id_ejecutado_por?: number;
  observaciones?: string;
}

export interface Pago {
  id: number;
  numero: string;
  id_documento_origen: number;
  numero_documento: string | null;
  clase_documento: string | null;
  numero_requerimiento: string | null;
  proveedor: string | null;
  ruc: string | null;
  centro_costo: string | null;
  moneda_id: string | null;
  moneda_simbolo: string | null;
  concepto: Concepto;
  fecha_pago: string;
  monto: string;
  moneda_cuenta: string;
  tipo_cambio: string | null;
  monto_cuenta: string;
  medio_pago: MedioPago;
  id_cuenta: number;
  cuenta: string | null;
  banco: string | null;
  numero_cuenta: string | null;
  cuenta_destino: string | null;
  numero_operacion: string | null;
  ejecutado_por: string | null;
  estado: 'REGISTRADO' | 'ANULADO';
  observaciones: string | null;
  created_at: string;
}

export interface PagoQuery {
  page?: number;
  pageSize?: number;
  desde?: string;
  hasta?: string;
  id_documento_origen?: number;
  id_cuenta?: number;
  estado?: 'REGISTRADO' | 'ANULADO';
}

export interface ResumenFila {
  nombre: string;
  monto_soles: string;
  cantidad: number;
}

export interface BucketVencimiento {
  monto_soles: string;
  cantidad: number;
}

export interface Resumen {
  moneda: string;
  sin_tipo_cambio: number;
  kpis: { comprometido: string; programado: string; pagado: string; saldo_por_pagar: string; documentos: number };
  por_mes: { mes: string; comprometido_soles: string; pagado_soles: string }[];
  deuda_por_centro_costo: ResumenFila[];
  deuda_por_grupo_centro_costo: ResumenFila[];
  deuda_por_area: ResumenFila[];
  vencimientos: {
    vencidos: BucketVencimiento;
    esta_semana: BucketVencimiento;
    este_mes: BucketVencimiento;
    mas_adelante: BucketVencimiento;
    sin_fecha: BucketVencimiento;
    proximos: { id: number; numero_documento: string | null; proveedor: string | null; vencimiento: string | null; saldo_soles: string }[];
  };
  pagado_por_proveedor: ResumenFila[];
  programado_por_cuenta: ResumenFila[];
}

export interface ResumenQuery {
  desde?: string;
  hasta?: string;
  id_centro_costo?: number;
  id_centro_costos_principal?: number;
  id_area?: number;
  clase_documento?: string;
}

export interface Retenciones {
  periodo: string;
  retenciones: {
    id: number;
    numero_documento: string | null;
    proveedor: string | null;
    ruc: string | null;
    fecha_pago: string;
    moneda_simbolo: string | null;
    total: string;
    retencion_monto: string;
  }[];
  detracciones: {
    id: number;
    numero_pago: string;
    numero_documento: string | null;
    proveedor: string | null;
    ruc: string | null;
    fecha_pago: string;
    monto: string;
    constancia: string | null;
  }[];
  totales: { retenciones: string; detracciones_soles: string };
  nota: string;
}
