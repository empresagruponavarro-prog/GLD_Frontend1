import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CentroCosto, CatalogosFiltros } from './interfaces';
import { environment } from '@env';

@Service()
export class CentrosCostosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/centros-costos`;

  getAll(): Observable<CentroCosto[]> {
    return this.http.get<CentroCosto[]>(this.apiUrl);
  }

  getCatalogosFiltros(): Observable<CatalogosFiltros> {
    return this.http.get<CatalogosFiltros>(`${this.apiUrl}/catalogos-filtros`);
  }

  getById(id: number | string): Observable<CentroCosto> {
    return this.http.get<CentroCosto>(`${this.apiUrl}/${id}`);
  }

  create(data: CentroCosto): Observable<CentroCosto> {
    return this.http.post<CentroCosto>(this.apiUrl, data);
  }

  update(id: number | string, data: Partial<CentroCosto>): Observable<CentroCosto> {
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
