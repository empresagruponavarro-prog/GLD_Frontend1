import { MedioPago } from '../../requerimientos/requerimientos.models';

/**
 * Cotizaciones por ítem del presupuesto Meta y sus compromisos (plan 09). Tipos de lo que devuelve el backend
 * (`presupuestos/:id/cotizaciones`, `cuadro-comparativo`, `adjudicacion` y `compromisos`).
 */

/** Estado de una orden de compra o de servicio: PROVISIONAL mientras el presupuesto no se aprueba. */
export type EstadoDocumentoPpto = 'PROVISIONAL' | 'REGISTRADO' | 'ANULADO';

export interface CompromisoItem {
  id_requerimiento: number;
  numero_requerimiento: string;
  estado_requerimiento: string;
  id_documento: number | null;
  numero_documento: string | null;
  estado_documento: EstadoDocumentoPpto | null;
}

/** Lo que el diálogo de ítems muestra de cada ítem de un presupuesto. */
export interface ResumenCotizacionItem {
  cotizaciones: number;
  adjudicado: {
    id_cotizacion: number;
    id_cot_detalle: number;
    numero_cotizacion: string;
    id_proveedor: number;
    proveedor: string | null;
    moneda_id: string;
    moneda_simbolo: string | null;
    /** Precio unitario sin IGV del ganador, en su moneda. */
    precio_sin_igv: string;
    adjudicado_por: string | null;
    fecha_adjudicacion: string | null;
  } | null;
  compromiso: CompromisoItem | null;
  /** Ya tiene una orden registrada: no cambia de proveedor. */
  cubierto: boolean;
}

// ---------------------------------------------------------------- cotizaciones

export interface PptoCotizacionLinea {
  id: number;
  id_ppto_item: number;
  numero_item: string | null;
  id_subfase: number;
  subfase: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cotiza: boolean;
  cantidad: string;
  /** Cantidad que hoy pide el ítem. */
  cantidad_item: string;
  cantidad_distinta: boolean;
  precio_unitario: string;
  precio_sin_igv: string;
  precio_con_igv: string;
  subtotal_sin_igv: string;
  plazo_entrega_dias: number | null;
  marca_modelo: string | null;
  observaciones: string | null;
  adjudicada: boolean;
}

export interface PptoCotizacion {
  id: number;
  numero: string;
  id_presupuesto: number;
  id_detalle_fase: number;
  fase: string;
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
  registrado_por: string | null;
  total_sin_igv: string;
  igv: string;
  total: string;
  items_adjudicados: number;
  /** Alguno de sus ítems ya tiene una orden registrada: es solo de consulta. */
  protegida: boolean;
  lineas: PptoCotizacionLinea[];
  /** Solo al grabar: lo que se generó o actualizó. */
  compromisos?: Conciliacion;
}

export interface PptoCotizacionLineaPayload {
  id_ppto_item: number;
  cotiza?: boolean;
  cantidad: string;
  precio_unitario: string;
  plazo_entrega_dias?: number;
  marca_modelo?: string;
  observaciones?: string;
  /** true = gana el ítem; false = lo suelta si lo ganaba; sin valor = no cambia. */
  adjudicar?: boolean;
}

export interface PptoCotizacionPayload {
  id_detalle_fase?: number;
  id_proveedor: number;
  fecha: string;
  referencia?: string;
  moneda_id: string;
  moneda_simbolo?: string;
  incluye_igv?: boolean;
  afecto_igv?: boolean;
  forma_pago: string;
  dias_credito?: number;
  adelanto_porcentaje?: string;
  medio_pago?: MedioPago;
  plazo_entrega_dias?: number;
  validez_dias?: number;
  garantia?: string;
  condiciones?: string;
  archivo_url?: string;
  comentario_adjudicacion?: string;
  lineas: PptoCotizacionLineaPayload[];
}

// ---------------------------------------------------------------- cuadro y adjudicación

export interface CuadroOfertaPpto {
  id_cotizacion: number;
  /** Es el valor de `id_cot_detalle` al adjudicar. */
  id_cot_detalle: number;
  cotiza: boolean;
  cantidad: string;
  precio_sin_igv: string;
  precio_con_igv: string;
  subtotal_sin_igv: string;
  plazo_entrega_dias: number | null;
  /** Cotiza la cantidad completa del ítem: solo así se puede adjudicar. */
  cantidad_completa: boolean;
}

export interface CuadroLineaPpto {
  id_ppto_item: number;
  numero_item: string | null;
  id_subfase: number;
  subfase: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo_unitario_meta: string;
  costo_total_meta: string;
  id_cot_detalle_ganadora: number | null;
  id_cotizacion_ganadora: number | null;
  adjudicado_por: string | null;
  fecha_adjudicacion: string | null;
  comentario_adjudicacion: string | null;
  cantidad_distinta: boolean;
  cubierto: boolean;
  compromiso: CompromisoItem | null;
  ofertas: CuadroOfertaPpto[];
}

export interface CuadroProveedorPpto {
  id_cotizacion: number;
  numero: string;
  id_proveedor: number;
  proveedor: string | null;
  moneda_id: string;
  moneda_simbolo: string | null;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje: string | null;
  medio_pago: string | null;
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
  items_ganados: number;
}

export interface CuadroComparativoPpto {
  id_presupuesto: number;
  codigo_presupuesto: string;
  estado: string;
  id_detalle_fase: number;
  fase: string;
  items_total: number;
  items_adjudicados: number;
  lineas: CuadroLineaPpto[];
  proveedores: CuadroProveedorPpto[];
}

export interface AdjudicacionPayload {
  items: { id_ppto_item: number; id_cot_detalle: number | null }[];
  comentario?: string;
}

export interface AdjudicacionResponse {
  adjudicados: number;
  liberados: number;
  sin_cambio: number;
  compromisos: Conciliacion;
}

// ---------------------------------------------------------------- compromisos

export interface DocumentoCompromiso {
  id: number;
  numero_documento: string;
  clase: 'ORDEN_COMPRA' | 'ORDEN_SERVICIO';
}

export interface CompromisoGenerado {
  id_requerimiento: number;
  numero: string;
  fase: string;
  id_proveedor: number;
  proveedor: string | null;
  documentos: DocumentoCompromiso[];
}

/** Lo que dejó la conciliación al grabar. */
export interface Conciliacion {
  creados: CompromisoGenerado[];
  actualizados: CompromisoGenerado[];
  anulados: { id_requerimiento: number; numero: string }[];
  sin_cambio: number;
}

export interface CompromisoDocumentoPanel {
  id: number;
  numero_documento: string;
  clase: 'ORDEN_COMPRA' | 'ORDEN_SERVICIO';
  estado: EstadoDocumentoPpto;
  total: string;
  moneda_simbolo: string | null;
  fecha_emision: string | null;
}

export interface CompromisoPanel {
  id_requerimiento: number;
  numero: string;
  estado_requerimiento: string;
  estado: EstadoDocumentoPpto;
  fase: string | null;
  id_proveedor: number | null;
  proveedor: string | null;
  lineas: number;
  documentos: CompromisoDocumentoPanel[];
}

export interface CompromisosPresupuesto {
  id_presupuesto: number;
  codigo_presupuesto: string;
  estado: string;
  items_total: number;
  items_adjudicados: number;
  items_sin_adjudicar: { id_ppto_item: number; codigo: string; descripcion: string; fase: string }[];
  conflictos: { id_ppto_item: number; codigo: string; documentos: string[] }[];
  compromisos: CompromisoPanel[];
}

/** Texto corto de lo que dejó una grabación, para el aviso al usuario; vacío si no cambió nada. */
export function resumenConciliacion(c: Conciliacion | undefined): string {
  if (!c) return '';
  const partes: string[] = [];
  if (c.creados.length > 0) {
    const docs = c.creados.flatMap((f) => f.documentos.map((d) => d.numero_documento));
    partes.push(`${c.creados.length} FUR nuevo(s) (${c.creados.map((f) => f.numero).join(', ')}) y ${docs.length} orden(es): ${docs.join(', ')}`);
  }
  if (c.actualizados.length > 0) partes.push(`${c.actualizados.length} FUR actualizado(s) (${c.actualizados.map((f) => f.numero).join(', ')})`);
  if (c.anulados.length > 0) partes.push(`${c.anulados.length} FUR anulado(s) (${c.anulados.map((f) => f.numero).join(', ')})`);
  return partes.join(' · ');
}
