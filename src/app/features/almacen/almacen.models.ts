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

export interface ProductoSelectOption {
  id: number;
  descripcion: string;
}

// ------------------------------------------------------------------ Almacenes
export interface Almacen {
  id: number;
  codigo: string;
  nombre: string;
  id_empresa: number | null;
  estado: boolean;
}

export type AlmacenPayload = Partial<Omit<Almacen, 'id'>>;

// ------------------------------------------------------------------ Documentos
export type Naturaleza = 'INGRESO' | 'SALIDA' | 'TRANSFERENCIA';

export const MOTIVOS_INGRESO = ['COMPRA', 'DEVOLUCION', 'INGRESO_CLIENTE', 'AJUSTE_POSITIVO'] as const;
export const MOTIVOS_SALIDA = ['CONSUMO', 'VENTA', 'BAJA', 'AJUSTE_NEGATIVO'] as const;

export type Motivo =
  | 'INVENTARIO_INICIAL'
  | (typeof MOTIVOS_INGRESO)[number]
  | (typeof MOTIVOS_SALIDA)[number]
  | 'TRANSFERENCIA';

export const MOTIVO_LABEL: Record<string, string> = {
  INVENTARIO_INICIAL: 'Inventario inicial',
  COMPRA: 'Compra',
  DEVOLUCION: 'Devolución',
  INGRESO_CLIENTE: 'Ingreso de cliente',
  AJUSTE_POSITIVO: 'Ajuste positivo',
  CONSUMO: 'Consumo',
  VENTA: 'Venta',
  BAJA: 'Baja',
  AJUSTE_NEGATIVO: 'Ajuste negativo',
  TRANSFERENCIA: 'Transferencia',
};

/** Motivos que exigen costo unitario en cada línea. */
export const MOTIVOS_CON_COSTO: readonly string[] = ['INVENTARIO_INICIAL', 'COMPRA', 'INGRESO_CLIENTE'];

export interface DocumentoLinea {
  id: number;
  id_producto: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo_unitario: string | null;
  observaciones: string | null;
  id_orden_compra_detalle: number | null;
}

export interface Documento {
  id: number;
  numero: string;
  naturaleza: Naturaleza;
  motivo: Motivo;
  fecha: string;
  id_almacen: number;
  almacen: string;
  id_almacen_destino: number | null;
  almacen_destino: string | null;
  documento_referencia: string | null;
  id_proveedor: number | null;
  proveedor: string | null;
  id_centro_costo: number | null;
  centro_costo: string | null;
  id_recibido_por: number | null;
  recibido_por: string | null;
  id_solicitado_por: number | null;
  solicitado_por: string | null;
  id_entregado_a: number | null;
  entregado_a: string | null;
  motivo_trabajo: string | null;
  observaciones: string | null;
  estado: 'REGISTRADO' | 'ANULADO';
  id_documento_anula: number | null;
  id_orden_compra: number | null;
  numero_oc: string | null;
  created_at: string;
  total_lineas: number;
  lineas?: DocumentoLinea[];
}

export interface DocumentoLineaPayload {
  id_producto: number;
  cantidad: string;
  costo_unitario?: string;
  observaciones?: string;
}

export interface DocumentoPayload {
  fecha: string;
  motivo: Motivo;
  id_almacen: number;
  id_almacen_destino?: number;
  documento_referencia?: string;
  id_proveedor?: number;
  id_centro_costo?: number;
  id_recibido_por?: number;
  id_solicitado_por?: number;
  id_entregado_a?: number;
  motivo_trabajo?: string;
  observaciones?: string;
  lineas: DocumentoLineaPayload[];
}

export interface DocumentoQuery {
  page?: number;
  pageSize?: number;
  desde?: string;
  hasta?: string;
  id_almacen?: number;
  motivo?: Motivo;
  id_proveedor?: number;
  id_centro_costo?: number;
  estado?: 'REGISTRADO' | 'ANULADO';
}

// ------------------------------------------------------------------ Préstamos
export type Condicion = 'OPERATIVO' | 'NO_OPERATIVO' | 'CON_FALTANTES' | 'DANADO';
export const CONDICION_LABEL: Record<Condicion, string> = {
  OPERATIVO: 'Operativo',
  NO_OPERATIVO: 'No operativo',
  CON_FALTANTES: 'Con faltantes',
  DANADO: 'Dañado',
};

export type EstadoPrestamo = 'ABIERTO' | 'PARCIAL' | 'CERRADO' | 'ANULADO';
export type EstadoPlazo =
  | 'EN_PLAZO'
  | 'VENCE_HOY'
  | 'VENCIDO'
  | 'RETORNADO_A_TIEMPO'
  | 'RETORNADO_CON_RETRASO'
  | 'ANULADO';

export const ESTADO_PLAZO_LABEL: Record<EstadoPlazo, string> = {
  EN_PLAZO: 'En plazo',
  VENCE_HOY: 'Vence hoy',
  VENCIDO: 'Vencido',
  RETORNADO_A_TIEMPO: 'Retornado a tiempo',
  RETORNADO_CON_RETRASO: 'Retornado con retraso',
  ANULADO: 'Anulado',
};

export interface PrestamoLinea {
  id: number;
  id_producto: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  cantidad_devuelta: string;
  cantidad_pendiente: string;
}

export interface PrestamoRetorno {
  id: number;
  id_prestamo_detalle: number;
  fecha_retorno: string;
  cantidad: string;
  condicion: Condicion;
  observaciones: string | null;
}

export interface Prestamo {
  id: number;
  numero: string;
  fecha_prestamo: string;
  id_almacen: number;
  almacen: string;
  id_centro_costo: number | null;
  centro_costo: string | null;
  id_responsable: number;
  responsable: string;
  documento_referencia: string | null;
  dias_autorizados: number;
  fecha_prevista_retorno: string;
  estado: EstadoPrestamo;
  estado_plazo: EstadoPlazo;
  dias_fuera: number;
  observaciones: string | null;
  created_at: string;
  total_lineas: number;
  lineas?: PrestamoLinea[];
  retornos?: PrestamoRetorno[];
}

export interface PrestamoPayload {
  fecha_prestamo: string;
  id_almacen: number;
  id_centro_costo?: number;
  id_responsable: number;
  documento_referencia?: string;
  dias_autorizados: number;
  observaciones?: string;
  lineas: { id_producto: number; cantidad: string }[];
}

export interface RetornoPayload {
  fecha_retorno: string;
  retornos: {
    id_prestamo_detalle: number;
    cantidad: string;
    condicion: Condicion;
    observaciones?: string;
  }[];
}

export interface PrestamoQuery {
  page?: number;
  pageSize?: number;
  estado?: EstadoPrestamo;
  estado_plazo?: EstadoPlazo;
  id_responsable?: number;
  id_centro_costo?: number;
  id_almacen?: number;
  numero?: string;
}

// ------------------------------------------------------------------ Stock
export type Alerta = 'OK' | 'SIN_STOCK' | 'BAJO_MINIMO' | 'EQUIPO_NO_OPERATIVO';
export type ClaseInventario = 'CONSUMIBLE' | 'EQUIPO_RETORNABLE' | 'MERCADERIA_CLIENTE';

export const CLASE_LABEL: Record<ClaseInventario, string> = {
  CONSUMIBLE: 'Consumible',
  EQUIPO_RETORNABLE: 'Equipo retornable',
  MERCADERIA_CLIENTE: 'Mercadería de cliente',
};

export const ALERTA_LABEL: Record<Alerta, string> = {
  OK: 'OK',
  SIN_STOCK: 'Sin stock',
  BAJO_MINIMO: 'Bajo mínimo',
  EQUIPO_NO_OPERATIVO: 'Equipo no operativo',
};

export interface StockRow {
  id_producto: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  familia: string | null;
  clase_inventario: ClaseInventario;
  almacen_default: string | null;
  stock_total: string;
  prestado: string;
  no_operativo: string;
  disponible: string;
  stock_minimo: string;
  stock_objetivo: string;
  compra_sugerida: string;
  costo_promedio: string;
  valor_total: string;
  alerta: Alerta;
}

export interface StockQuery {
  page?: number;
  pageSize?: number;
  id_almacen?: number;
  id_familia?: number;
  clase_inventario?: ClaseInventario;
  alerta?: Alerta;
  q?: string;
  incluir_sin_stock?: boolean;
}

// ------------------------------------------------------------------ Kardex
export interface KardexRow {
  id: number;
  fecha: string;
  movimiento: string;
  documento: string;
  documento_referencia: string | null;
  id_producto: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  id_almacen: number;
  almacen: string;
  entrada: string;
  salida: string;
  saldo_almacen: string;
  saldo_total: string;
  costo_unitario: string;
  costo_total: string;
  costo_promedio: string;
  contraparte: string | null;
}

export interface KardexQuery {
  page?: number;
  pageSize?: number;
  id_producto?: number;
  id_almacen?: number;
  desde?: string;
  hasta?: string;
}

// ------------------------------------------------------------------ Consulta
export interface ConsultaFicha {
  id: number;
  codigo: string;
  descripcion: string;
  categoria: string;
  familia: string | null;
  uso_principal: string | null;
  unidad: string;
  clase_inventario: ClaseInventario;
  estado_operativo: string;
  almacen_default: string | null;
  stock_total: string;
  disponible: string;
  stock_minimo: string;
  stock_objetivo: string;
  costo_promedio: string;
}

export interface StockAlmacen {
  id_almacen: number;
  almacen: string;
  cantidad: string;
  prestado: string;
  no_operativo: string;
  disponible: string;
}

export interface ConsultaAlternativa {
  prioridad: number;
  id_producto: number;
  codigo: string;
  descripcion: string;
  disponible: string;
  costo_promedio: string;
}

export interface Consulta {
  producto: ConsultaFicha | null;
  coincidencias: { id: number; codigo: string; descripcion: string }[];
  stock_por_almacen: StockAlmacen[];
  alternativas: ConsultaAlternativa[];
}

// ------------------------------------------------------------------ Familias
export interface FamiliaOption {
  id: number;
  nombre: string;
  prefijo: string;
}

// ------------------------------------------------------------------ Recepción de compras
export interface RecepcionPendiente {
  id: number;
  id_oc: string | null;
  numero_oc: string | null;
  fecha_emision: string | null;
  proveedor: string | null;
  id_centro_costo: number | null;
  centro_costo: string | null;
  numero_requerimiento: string | null;
  moneda_simbolo: string | null;
  total: string | null;
  lineas_pendientes: number;
}

export interface RecepcionLinea {
  id_detalle: number;
  id_producto: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  recibida: string;
  saldo: string;
  precio: string | null;
}

export interface RecepcionNoRecibible {
  id_detalle: number;
  descripcion: string;
  motivo: string;
}

export interface RecepcionOrdenCompra {
  id: number;
  id_oc: string | null;
  numero_oc: string | null;
  fecha_emision: string | null;
  id_proveedor: number | null;
  proveedor: string | null;
  id_centro_costo: number | null;
  centro_costo: string | null;
  numero_requerimiento: string | null;
  moneda_simbolo: string | null;
  es_soles: boolean;
  total: string | null;
  lineas: RecepcionLinea[];
  no_recibibles: RecepcionNoRecibible[];
}

export interface RecepcionPayload {
  id_orden_compra: number;
  id_almacen: number;
  fecha: string;
  id_recibido_por?: number;
  tipo_cambio?: string;
  observaciones?: string;
  lineas: { id_orden_compra_detalle: number; cantidad: string }[];
}
