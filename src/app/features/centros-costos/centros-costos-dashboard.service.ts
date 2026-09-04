import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CentroCostoItem {
  CodCentroCto: string;
  CodCentroCtoPrincipal?: string;
  CentroCosto: string;
  Estado?: string;
  CodEmpresa?: string;
  CodCliente?: string;
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

  getCentrosCostos(): Observable<CentroCostoItem[]> {
    return this.http.get<CentroCostoItem[]>(this.apiUrl);
  }

  getResumenFinanciero(id: string): Observable<ResumenFinanciero> {
    return this.http.get<ResumenFinanciero>(`${this.apiUrl}/${id}/resumen-financiero`);
  }
}
