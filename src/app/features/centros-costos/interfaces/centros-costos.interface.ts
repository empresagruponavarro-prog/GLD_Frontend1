export interface CentroCostoItem {
  id?: number;
  id_empresa?: number;
  id_anexo?: number;
  id_centro_costo?: number;
  id_centro_costos_principal?: number;
  id_centro_costo_principal?: number;
  idCentroCostosPrincipal?: number;
  CodCentroCto?: string;
  CodCentroCtoPrincipal?: string;
  CentroCostoPrincipal?: string;
  CentroCosto: string;
  Estado?: string;
  CodEmpresa?: string;
  Empresa?: string;
  IdPeriodo?: string;
  periodo?: number;
  CodCliente?: string;
  Cliente?: string;
  PresupuestoEstado?: string;
  PresupuestoCostoDirecto?: number;
  PresupuestoGastosGenerales?: number;
  PresupuestoViaticos?: number;
  PresupuestoMonto?: string | number;
  OCFile?: string;
  FechaIncio?: string;
  FechaFinProg?: string;
  FechaFinReal?: string;
}

export type CentroCosto = CentroCostoItem;

export interface CreateCentroCostoDto {
  periodo: number;
  CodCliente: string;
  id_centro_costos_principal?: number;
  id_empresa?: number;
  id_anexo?: number;
  CentroCosto: string;
  FechaIncio: string;
  Estado?: string;
  FechaFinProg?: string;
  FechaFinReal?: string;
  PresupuestoEstado?: string;
  PresupuestoCostoDirecto?: number;
  PresupuestoGastosGenerales?: number;
  PresupuestoViaticos?: number;
  PresupuestoMonto?: number;
  OCFile?: string;
}

export type UpdateCentroCostoDto = Partial<CreateCentroCostoDto>;

/**
 * Respuesta cruda de `GET /centros-costos`: hoy paginada; se admite también la lista sin paginar
 * (versiones anteriores de la API). La normaliza `CentrosCostosService.getAll`.
 */
export type RespuestaCentrosCostos = CentroCostoItem[] | Partial<PaginatedCentrosCostos> | null;

export interface PaginatedCentrosCostos {
  data: CentroCostoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ConteoEstados {
  total: number;
  abiertos: number;
  cerrados: number;
}

export interface CatalogosFiltros {
  empresas: string[];
  periodos: string[];
  clientes: string[];
  estados: string[];
  pptoEstados: string[];
}

export interface FiltrosCentrosCostos {
  search?: string;
  estado?: string;
  empresa?: string;
  periodo?: string;
  cliente?: string;
  centroCosto?: string;
  pptoEstado?: string;
  pptoEstadoGrupo?: PptoEstadoGrupo;
}

/** Grupos de estado de presupuesto: abierto = ABIERTO o APROBADO, cierre, cerrado. */
export type PptoEstadoGrupo = 'abierto' | 'cierre' | 'cerrado';

/** `GET /centros-costos/metricas/presupuestos`: conteos por grupo y portafolio de todos los CC. */
export interface MetricasPresupuestosCC {
  total: number;
  abiertos: number;
  enCierre: number;
  cerrados: number;
  totalPortafolio: number;
}

/** `GET /centros-costos/:id/resumen-financiero` (`CentroCostoResumenResponseDto`). */
export interface ResumenFinanciero {
  id: number;
  presupuestoBase: number;
  presupuestoComercial: number;
  gastosAcumulados: number;
  pagosRealizados: number;
  saldoActual: number;
  porcentajeEjecucion: number;
  gastosFacturas?: number;
  gastosCajaChica?: number;
  pagosPlanillas?: number;
}

/** Valor `Decimal` de Prisma tal como llega en el JSON. */
export type DecimalApi = string | number | null;

/** Presupuesto asignado a un centro de costos (`GET /centros-costos/:id/presupuestos`, filas de `ppto_Principal`). */
export interface PresupuestoDeCentroCosto {
  id: number;
  IdPresupuesto: string | null;
  id_empresa: number | null;
  periodo: number | null;
  Version: string | null;
  TipoPpto: string | null;
  Proyecto: string | null;
  CodCentroCto: string | null;
  id_centro_costo: number | null;
  CostoDirecto: DecimalApi;
  GastosGenerales: DecimalApi;
  Viaticos: DecimalApi;
  Total: DecimalApi;
  Estado: string | null;
}

export interface CentroCostoSelect {
  id: number;
  nombre: string;
}

export interface CentroCostoPrincipal {
  id: number;
  centro_costo_principal: string;
  descripcion: string;
  estado: string;
  id_empresa: number;
  Empresa?: string;
}

