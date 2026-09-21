export interface CentroCostoItem {
  id?: number;
  id_empresa?: number;
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
  id_centro_costos_principal: number;
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
}

export interface ResumenFinanciero {
  codCentroCto: string;
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

