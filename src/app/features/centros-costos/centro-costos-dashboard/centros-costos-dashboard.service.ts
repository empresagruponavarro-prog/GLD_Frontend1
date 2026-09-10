import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  CentroCostoItem, 
  ConteoEstados, 
  CatalogosFiltros, 
  FiltrosCentrosCostos, 
  ResumenFinanciero 
} from '../interfaces';
import { environment } from '../../../../environments/environment';

export * from '../interfaces';

@Service()
export class CentrosCostosDashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/centros-costos`;

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
