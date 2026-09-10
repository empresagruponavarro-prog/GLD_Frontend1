export interface CentroCostoItem {
  CodCentroCto: string;
  CodCentroCtoPrincipal?: string;
  CentroCostoPrincipal?: string;
  CentroCosto: string;
  Estado?: string;
  CodEmpresa?: string;
  Empresa?: string;
  IdPeriodo?: string;
  CodCliente?: string;
  Cliente?: string;
  PresupuestoEstado?: string;
  PresupuestoMonto?: string | number;
}

export type CentroCosto = CentroCostoItem;

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
