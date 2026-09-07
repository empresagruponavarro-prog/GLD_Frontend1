export interface PresupuestoPrincipal {
  IdPresupuesto: number;
  CodCentroCto?: string;
  CodEmpresa?: string;
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

export interface HistorialVersion {
  IdVersion: number;
  IdPresupuesto: number;
  VersionNumero: string;
  TotalCostoDirectoAnterior?: number;
  TotalCostoDirectoNuevo?: number;
  TotalGastosGeneralesAnterior?: number;
  TotalGastosGeneralesNuevo?: number;
  MotivoCambio?: string;
  UsuarioModifico?: string;
  FechaModificacion?: string;
}
