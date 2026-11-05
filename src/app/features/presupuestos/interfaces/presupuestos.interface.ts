/** Estado normalizado del presupuesto (GRP): la fuente de verdad; `Estado` es solo un espejo en texto. */
export type EstadoPresupuesto = 'EN_DESARROLLO' | 'EN_REVISION' | 'OBSERVADO' | 'APROBADO' | 'ENTREGADO' | 'LIQUIDADO' | 'ANULADO';

/** Estados posteriores a la aprobación: ya no se editan ni se aprueban de nuevo. */
export const ESTADOS_PPTO_APROBADOS: readonly EstadoPresupuesto[] = ['APROBADO', 'ENTREGADO', 'LIQUIDADO'];

export function presupuestoAprobado(estado: string | undefined | null): boolean {
  return ESTADOS_PPTO_APROBADOS.includes(estado as EstadoPresupuesto);
}

export interface PresupuestoPrincipal {
  id?: number;
  IdPresupuesto: string | number;
  id_centro_costo?: number;
  id_empresa?: number;
  periodo?: string;
  CodCentroCto?: string;
  CodEmpresa?: string;
  IdPeriodo?: string;
  Version?: string;
  TipoPpto?: string;
  Proyecto?: string;
  Cliente?: string;
  CodigoAnexo?: string;
  Concepto?: string;
  CodCentroCtoPrincipal?: string;
  FechaRequerimiento?: string;
  FechaEntrega?: string;
  CostoDirecto?: number;
  GGPorcentaje?: number;
  GastosGenerales?: number;
  UtiliPorcentaje?: number;
  Utilidad?: number;
  Viaticos?: number;
  DsctoComercial?: number;
  SubTotalSinIGV?: number;
  IGV?: number;
  Total?: number;
  Estado?: string;
  Comentarios?: string;
  Usuario?: string;
  MonedaBase?: string;
  TotalCostoDirecto?: number;
  TotalGastosGenerales?: number;
  TotalViaticos?: number;
  PresupuestoBaseTotal?: number;
  PorcentajeUtilidadOfertada?: number;
  MontoUtilidadOfertada?: number;
  PresupuestoComercialOfertado?: number;
  MontoContratoOriginal?: number;
  MontoCostoCeroOriginal?: number;
  IdEstadoPresupuesto?: string;
  FechaCreacion?: string;
  FechaAprobacion?: string;
  AprobadoPor?: string;
  /** GRP: estado normalizado, versión y aprobación. */
  estado_ppto?: EstadoPresupuesto;
  numero_version?: number;
  id_version_de?: number | null;
  aprobado_por?: string | null;
  fecha_aprobacion?: string | null;
}

// ─── Aprobación del presupuesto (GRP) ───────────────────────────────────────

/** Algo que falta completar en el presupuesto para poder aprobarlo. */
export interface ProblemaPresupuesto {
  codigo: 'SIN_FASES' | 'FASE_SIN_CATEGORIAS' | 'CATEGORIA_SIN_ITEMS' | 'ITEM_VACIO';
  mensaje: string;
  idFase?: number;
  idCategoria?: number;
  idItem?: number;
  fase?: string;
  categoria?: string;
}

/** Regla de negocio que impide aprobar (aparte de lo que falta completar). */
export interface BloqueoAprobacion {
  codigo: 'YA_APROBADO' | 'ANULADO' | 'SIN_CENTRO_COSTO' | 'OTRO_PRINCIPAL' | 'SIN_PRINCIPAL';
  mensaje: string;
}

export interface ValidacionPresupuesto {
  id: number;
  id_presupuesto: string | null;
  estado_ppto: EstadoPresupuesto;
  tipo: 'Principal' | 'Adicional';
  puede_aprobar: boolean;
  problemas: ProblemaPresupuesto[];
  bloqueos: BloqueoAprobacion[];
  resumen: { fases: number; categorias: number; items: number; costo_directo: string };
}

export interface EstructuraCapturada {
  /** Se crearon partidas y subpartidas en la obra. */
  capturada: boolean;
  partidas: number;
  subpartidas: number;
  /** Por qué no se capturó (la obra ya tiene estructura, faltan fechas del centro de costo…). */
  motivo?: string;
}

export interface AprobarPresupuestoResponse {
  id: number;
  id_presupuesto: string | null;
  estado_ppto: EstadoPresupuesto;
  tipo: 'Principal' | 'Adicional';
  estructura: EstructuraCapturada;
  /** Versión anterior a la que reemplaza (pasó a ANULADO). */
  reemplaza?: { id: number; id_presupuesto: string | null };
}

export interface LimpiarVaciosResponse {
  items_eliminados: number;
  categorias_eliminadas: number;
  /** Fases que quedaron sin categorías: el usuario decide qué hacer con ellas. */
  fases_sin_categorias: { id: number; nombre: string }[];
  costo_directo: string;
}

export interface NuevaVersionResponse {
  id: number;
  id_presupuesto: string;
  numero_version: number;
  id_version_de: number;
  fases: number;
  categorias: number;
  items: number;
}

export interface PaginatedResponse {
  data: PresupuestoPrincipal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CategoriaFaseMaestra {
  id?: number;
  id_empresa?: number;
  IdCategoriaFase: number;
  CodigoFaseMaestra: string;
  NombreFaseMaestra: string;
  ClasificacionTipo?: string;
  EsActiva: boolean;
  CodEmpresa?: string;
}

export interface FaseMaestra {
  id: number;
  IdpptoFase: string;
  id_empresa?: number | null;
  FaseProyecto?: string | null;
}

export interface FaseCategoriaMaestra {
  id: number;
  IdpptoFaseCategoria: string;
  IdpptoFase?: string | null;
  Descripcion?: string | null;
}

export interface FaseAsignada {
  id?: number;
  IdFaseAsignada: number;
  IdPresupuesto: number;
  IdCategoriaFase: number;
  id_empresa?: number;
  id_centro_costo?: number;
  CodEmpresa?: string;
  CodCentroCto?: string;
  MontoAsignadoBase?: number;
  MontoAsignadoActual?: number;
  FechaAsignacion?: string;
  NotasAdicionales?: string;
}

export interface FasePorCentroCosto {
  id: number;
  descripcion: string | null;
}

export interface CategoriaAsignada {
  id?: number;
  id_empresa?: number;
  id_centro_costo?: number;
  IdPresupuesto?: number | string;
  IdCategoriaFase?: number | string;
  CodEmpresa?: string;
  CodCentroCto?: string;
  CategoriaInsumo?: string;
  [key: string]: unknown;
}

export interface DetalleFaseCate {
  id: number;
  categoria?: { id?: number; descripcion?: string; nombre?: string } | null;
  id_categoria?: number | null;
  IdPresupuestoDetalleCategoria?: string;
  IdPresupuestoDetalle?: string;
  IdPresupuesto?: string;
  IdpptoFase?: string;
  IdpptoFaseCategoria?: string;
  CategoriaInsumo?: string;
  SubTotalCategoria?: string | number;
  CostoDirecto?: string | number;
  /** Cantidad de ítems (productos/servicios) de la partida. */
  totalItems?: number;
}

export interface DetalleFase {
  id: number;
  FaseProyecto?: string | null;
  IdPresupuestoDetalle: string;
  IdPresupuesto: string;
  id_empresa?: number;
  id_fase?: number | null;
  id_centro_costo?: number;
  IdpptoFase?: string;
  CodEmpresa?: string;
  CodCentroCto?: string;
  CostoDirecto?: string | number;
  Usuario?: string;
  FechaCreacion?: string;
  NombreFase?: string;
  categorias?: DetalleFaseCate[];
}

export interface Historial {
  id: number;
  IdPresupuesto?: string;
  Version?: string;
  Descripcion?: string;
  Usuario?: string;
  FechaCreacion?: string;
}

export interface PresupuestoCompleto extends PresupuestoPrincipal {
  centroCosto?: { NomCC?: string; CodCentroCto?: string } | null;
  fases?: DetalleFase[];
  historiales?: Historial[];
}

/** Subfase (categoría) de un presupuesto aprobado: a ella se imputan las líneas de FUR, OC/OS y salidas (GRP S-09). */
export interface SubfaseCentroCosto {
  id: number;
  subfase: string;
  fase: string;
  presupuesto: string;
}

export interface SubfasesCentroCosto {
  id_centro_costo: number;
  /** La obra tiene un presupuesto Principal aprobado: la salida CONSUMO debe indicar la subfase. */
  requerida: boolean;
  subfases: SubfaseCentroCosto[];
}

/** Presupuesto Comercial calculado: cada fase del Meta con la cotización ganadora de su FUR (GRP SP-16). */
export interface FaseComercial {
  id_fase: number;
  nombre_fase: string;
  meta: number;
  comercial: number;
  fuente: 'COTIZACION' | 'META';
  requerimientos: { id: number; numero: string; estado: string; proveedor: string | null; monto: number }[];
  /** Hay una ganadora en otra moneda sin tipo de cambio registrado: no está sumada. */
  sin_tipo_cambio: boolean;
}

export interface PresupuestoComercial {
  id: number;
  id_presupuesto: string | null;
  proyecto: string | null;
  id_centro_costo: number | null;
  estado_ppto: string;
  fases: FaseComercial[];
  total: { meta: number; comercial: number; diferencia: number };
  fases_cotizadas: number;
}

