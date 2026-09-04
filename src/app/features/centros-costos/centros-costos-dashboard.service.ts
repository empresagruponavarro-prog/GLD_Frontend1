import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class CentrosCostosDashboardService {
  private apiUrl = 'http://localhost:3000/centros-costos';

  constructor(private http: HttpClient) {}

  getCentrosCostos(filtros?: FiltrosCentrosCostos): Observable<CentroCostoItem[]> {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.search?.trim()) params = params.set('search', filtros.search.trim());
      if (filtros.estado?.trim() && filtros.estado !== 'TODOS') params = params.set('estado', filtros.estado.trim());
      if (filtros.empresa?.trim() && filtros.empresa !== 'TODOS') params = params.set('empresa', filtros.empresa.trim());
      if (filtros.periodo?.trim() && filtros.periodo !== 'TODOS') params = params.set('periodo', filtros.periodo.trim());
      if (filtros.cliente?.trim() && filtros.cliente !== 'TODOS') params = params.set('cliente', filtros.cliente.trim());
      if (filtros.centroCosto?.trim()) params = params.set('centroCosto', filtros.centroCosto.trim());
      if (filtros.pptoEstado?.trim() && filtros.pptoEstado !== 'TODOS') params = params.set('pptoEstado', filtros.pptoEstado.trim());
    }
    return this.http.get<CentroCostoItem[]>(this.apiUrl, { params });
  }

  getConteoEstados(): Observable<ConteoEstados> {
    return this.http.get<ConteoEstados>(`${this.apiUrl}/metricas/estados`);
  }

  getCatalogosFiltros(): Observable<CatalogosFiltros> {
    return this.http.get<CatalogosFiltros>(`${this.apiUrl}/catalogos-filtros`);
  }

  getResumenFinanciero(id: string): Observable<ResumenFinanciero> {
    return this.http.get<ResumenFinanciero>(`${this.apiUrl}/${id}/resumen-financiero`);
  }
}
