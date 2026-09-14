import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { 
  CentroCostoItem, 
  ConteoEstados, 
  CatalogosFiltros, 
  FiltrosCentrosCostos, 
  ResumenFinanciero,
  PaginatedCentrosCostos
} from '../interfaces';
import { environment } from '@env';

@Service()
export class CentrosCostosDashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/centros-costos`;

  getCentrosCostos(filtros?: FiltrosCentrosCostos, page = 1, pageSize = 20): Observable<PaginatedCentrosCostos> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (filtros) {
      if (filtros.search?.trim()) params = params.set('search', filtros.search.trim());
      if (filtros.estado?.trim() && filtros.estado !== 'TODOS') params = params.set('estado', filtros.estado.trim());
      if (filtros.empresa?.trim() && filtros.empresa !== 'TODOS') params = params.set('empresa', filtros.empresa.trim());
      if (filtros.periodo?.trim() && filtros.periodo !== 'TODOS') params = params.set('periodo', filtros.periodo.trim());
      if (filtros.cliente?.trim() && filtros.cliente !== 'TODOS') params = params.set('cliente', filtros.cliente.trim());
      if (filtros.centroCosto?.trim()) params = params.set('centroCosto', filtros.centroCosto.trim());
      if (filtros.pptoEstado?.trim() && filtros.pptoEstado !== 'TODOS') params = params.set('pptoEstado', filtros.pptoEstado.trim());
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((res: any): PaginatedCentrosCostos => {
        if (Array.isArray(res)) {
          const total = res.length;
          const start = (page - 1) * pageSize;
          const pagedData = res.slice(start, start + pageSize);
          return {
            data: pagedData,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
          };
        }
        if (res && Array.isArray(res.data)) {
          return {
            data: res.data,
            total: res.total ?? res.data.length,
            page: res.page ?? page,
            pageSize: res.pageSize ?? pageSize,
            totalPages: res.totalPages ?? (Math.ceil((res.total ?? res.data.length) / pageSize) || 1),
          };
        }
        return {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        };
      })
    );
  }

  getConteoEstados(): Observable<ConteoEstados> {
    return this.http.get<ConteoEstados>(`${this.apiUrl}/metricas/estados`);
  }

  getCatalogosFiltros(): Observable<CatalogosFiltros> {
    return this.http.get<CatalogosFiltros>(`${this.apiUrl}/catalogos-filtros`);
  }

  getResumenFinanciero(id: number | string): Observable<ResumenFinanciero> {
    return this.http.get<ResumenFinanciero>(`${this.apiUrl}/${id}/resumen-financiero`);
  }
}
