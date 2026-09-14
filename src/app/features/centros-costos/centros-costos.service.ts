import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CentroCosto, CatalogosFiltros, CentroCostoPrincipal, CreateCentroCostoDto, UpdateCentroCostoDto, PaginatedCentrosCostos, FiltrosCentrosCostos } from './interfaces';
import { environment } from '@env';

@Service()
export class CentrosCostosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/centros-costos`;

  getAll(page = 1, pageSize = 20, filtros?: FiltrosCentrosCostos): Observable<PaginatedCentrosCostos> {
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

    return this.http.get<PaginatedCentrosCostos>(this.apiUrl, { params });
  }

  getPrincipales(): Observable<CentroCostoPrincipal[]> {
    return this.http.get<CentroCostoPrincipal[]>(`${this.apiUrl}/principales`);
  }

  getCatalogosFiltros(): Observable<CatalogosFiltros> {
    return this.http.get<CatalogosFiltros>(`${this.apiUrl}/catalogos-filtros`);
  }

  getById(id: number | string): Observable<CentroCosto> {
    return this.http.get<CentroCosto>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateCentroCostoDto): Observable<CentroCosto> {
    return this.http.post<CentroCosto>(this.apiUrl, data);
  }

  update(id: number | string, data: UpdateCentroCostoDto): Observable<CentroCosto> {
    return this.http.patch<CentroCosto>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getResumenFinanciero(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/resumen-financiero`);
  }

  getPresupuestosByCentroCosto(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/presupuestos`);
  }
}
