/** Modelos de la lista de planos requeridos y de la liquidación de la obra (GRP F4/F5). */

export interface PlanoRequerido {
  id_tipo_plano: number;
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  entregado: boolean;
  entregado_por: string | null;
  entregado_en: string | null;
}

export interface FaltantePlano {
  id_tipo_plano: number;
  codigo: string;
  nombre: string;
}

export interface ResumenPlanos {
  total: number;
  obligatorios: number;
  entregados_obligatorios: number;
  faltantes: FaltantePlano[];
  /** No falta ningún plano obligatorio. */
  completo: boolean;
}

export interface PlanosRequeridosObra {
  id_centro_costo: number;
  id_tipo_proyecto: number | null;
  tipo_proyecto: string | null;
  items: PlanoRequerido[];
  resumen: ResumenPlanos;
}

export type CodigoRequisito = 'ESTADO' | 'AVANCE' | 'FIN_REAL' | 'PLANOS';

export interface RequisitoLiquidacion {
  codigo: CodigoRequisito;
  cumplido: boolean;
  mensaje: string;
}

export interface LiquidacionObra {
  id_centro_costo: number;
  estado_cc: string | null;
  liquidada: boolean;
  fecha_liquidacion: string | null;
  liquidado_por: string | null;
  fecha_fin_real: string | null;
  /** Avance real (0-100); nulo si la obra no está en el control de avance. */
  avance_real: number | null;
  puede_liquidar: boolean;
  requisitos: RequisitoLiquidacion[];
  planos: ResumenPlanos;
}

export type CodigoSeccionDosier = 'PRESUPUESTO_META' | 'PRESUPUESTO_COMERCIAL' | 'FICHA_OBRA' | 'INFORME_AVANCE' | 'PLANOS' | 'DOCUMENTOS';

export interface SeccionDosier {
  codigo: CodigoSeccionDosier;
  titulo: string;
  /** Hay algo que imprimir en esta sección. */
  disponible: boolean;
  referencias: string[];
  nota?: string;
}

export interface DosierObra {
  id_centro_costo: number;
  nombre_obra: string;
  fecha: string;
  secciones: SeccionDosier[];
  planos: ResumenPlanos;
}

/** Gasto de la obra por subfase frente al presupuesto Meta (se calcula al leer; GRP S-09). */
export interface GastoSubfase {
  /** `null` = gasto sin subfase. */
  id_ppto_detalle_categoria: number | null;
  subfase: string;
  meta: number | null;
  /** Servicios de OC/OS no anuladas. */
  directo: number;
  /** Salidas de almacén (PECOSA) a la obra. */
  indirecto: number;
  /** Bienes comprados que todavía no salieron. */
  compromiso: number;
  ejecutado: number;
  proyectado: number;
  saldo: number | null;
  sobre_meta: boolean;
}

export interface TotalesGasto {
  meta: number;
  directo: number;
  indirecto: number;
  compromiso: number;
  ejecutado: number;
  proyectado: number;
  saldo: number;
}

export interface GastoObra {
  id_centro_costo: number;
  subfases: GastoSubfase[];
  total: TotalesGasto;
  /** Líneas en otra moneda sin tipo de cambio registrado: no están en las sumas. */
  lineas_sin_tipo_cambio: number;
}
