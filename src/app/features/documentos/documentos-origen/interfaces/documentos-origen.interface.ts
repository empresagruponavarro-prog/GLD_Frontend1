export interface DocumentoOrigen {
  id: number;
  id_oc: string | null;
  tipo_costo: string | null;
  tipo_oc: string | null;
  numero_oc: string | null;
  id_centro_costo: number | null;
  nombre_centro_costo: string | null;
  id_categoria: number | null;
  id_fase: number | null;
  nombre_fase: string | null;
  periodo: string | null;
  mes: string | null;
  id_anexo: number | null;
  fecha_emision: string | null;
  forma_pago: string | null;
  moneda_id: string | null;
  moneda_simbolo: string | null;
  monto: string | null;
  igv: string | null;
  renta_4ta: string | null;
  dscto_compras: string | null;
  dscto_intervencion: string | null;
  dscto_otros: string | null;
  total: string | null;
  comentarios: string | null;
  oc_pdf: string | null;
  usuario: string | null;
  fecha_creacion: string | null;
  hora_creacion: string | null;
  cotizacion: string | null;
  id_requerimiento: number | null;
  numero_requerimiento: string | null;
  estado_recepcion: EstadoRecepcion | null;
}

export type EstadoRecepcion = 'PENDIENTE' | 'PARCIAL' | 'RECIBIDA' | 'SIN_BIENES';

export interface DetalleDocumentoOrigen {
  id_producto: number;
  cantidad: number;
  precio: number;
  /** Línea del requerimiento (FUR) que atiende; obligatoria si la OC nace de un requerimiento. */
  id_requerimiento_detalle?: number;
  /** Solo lectura en pantalla: texto del ítem cuando la OC nace de un requerimiento. */
  etiqueta?: string;
  /** Solo en pantalla: tope de cantidad (saldo del requerimiento) para validar antes de enviar. */
  maximo?: number;
}

export interface DetalleDocumentoOrigenItem {
  id: number;
  id_producto: number;
  producto_codigo: string | null;
  producto_descripcion: string | null;
  tipo_producto: string | null;
  cantidad: string | null;
  precio: string | null;
  monto: string | null;
  id_requerimiento_detalle: number | null;
  cantidad_recibida: string | null;
  saldo_por_recibir: string | null;
}

export interface DocumentoOrigenDetalle {
  id: number;
  tipo_oc: string | null;
  id_centro_costo: number | null;
  nombre_centro_costo: string | null;
  id_fase: number | null;
  nombre_fase: string | null;
  id_categoria: number | null;
  nombre_categoria: string | null;
  forma_pago: string | null;
  id_anexo: number | null;
  nombre_anexo: string | null;
  moneda_id: string | null;
  moneda_simbolo: string | null;
  monto: string | null;
  igv: string | null;
  total: string | null;
  id_requerimiento: number | null;
  numero_requerimiento: string | null;
  estado_recepcion: EstadoRecepcion | null;
  detalles: DetalleDocumentoOrigenItem[];
}

export interface CreateDocumentoOrigen {
  id_oc: string;
  tipo_costo: string;
  tipo_oc: string;
  numero_oc: string;
  id_centro_costo: number;
  id_categoria: number;
  id_fase: number;
  periodo: string;
  mes: string;
  id_anexo: number;
  fecha_emision: string;
  forma_pago: string;
  moneda_id: string;
  moneda_simbolo: string;
  igv: number;
  usuario: string;
  id_requerimiento?: number;
  detalles: DetalleDocumentoOrigen[];
}

export interface DocumentoOrigenQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  tipo_oc?: string;
  periodo?: string;
  mes?: string;
  id_centro_costo?: number;
  id_categoria?: number;
  id_anexo?: number;
  id_detalle_fase_categoria?: number;
}

export interface DocumentoOrigenPaginated {
  data: DocumentoOrigen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DocumentoOrigenDetalleLinea {
  id_documento: number;
  id_oc: string | null;
  numero_oc: string | null;
  id_centro_costo: number | null;
  nombre_centro_costo: string | null;
  id_fase: number | null;
  nombre_fase: string | null;
  id_anexo: number | null;
  nombre_anexo?: string | null;
  unidad_medida?: string | null;
  fecha_emision: string | null;
  id_detalle: number;
  id_producto: number | null;
  producto_codigo: string | null;
  producto_descripcion: string | null;
  tipo_producto: string | null;
  cantidad: string | number | null;
  precio: string | number | null;
  monto: string | number | null;
}
