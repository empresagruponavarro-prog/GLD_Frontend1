export interface PresupuestoPrincipal {
  id?: number;
  IdPresupuesto: string | number;
  CodCentroCto?: string;
  CodEmpresa?: string;
  IdPeriodo?: string;
  Version?: string;
  TipoPpto?: string;
  Proyecto?: string;
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
}

export interface PaginatedResponse {
  data: PresupuestoPrincipal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CategoriaFaseMaestra {
  IdCategoriaFase: number;
  CodigoFaseMaestra: string;
  NombreFaseMaestra: string;
  ClasificacionTipo?: string;
  EsActiva: boolean;
}

export interface FaseAsignada {
  IdFaseAsignada: number;
  IdPresupuesto: number;
  IdCategoriaFase: number;
  MontoAsignadoBase?: number;
  MontoAsignadoActual?: number;
  FechaAsignacion?: string;
  NotasAdicionales?: string;
}

export interface DetalleFaseCate {
  id: number;
  IdPresupuestoDetalle?: string;
  IdPresupuesto?: string;
  CategoriaInsumo?: string;
  SubTotalCategoria?: string | number;
}

export interface DetalleFase {
  id: number;
  IdPresupuestoDetalle: string;
  IdPresupuesto: string;
  IdpptoFase?: string;
  CodEmpresa?: string;
  CodCentroCto?: string;
  CostoDirecto?: string | number;
  Usuario?: string;
  FechaCreacion?: string;
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

