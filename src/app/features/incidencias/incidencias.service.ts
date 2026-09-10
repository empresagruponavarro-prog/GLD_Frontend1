import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Incidencia } from './interfaces';


@Service()
export class IncidenciasService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/incidencias';

  getAll(filters?: any): Observable<Incidencia[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key]);
        }
      });
    }
    return this.http.get<Incidencia[]>(this.apiUrl, { params });
  }

  create(incidencia: Incidencia): Observable<Incidencia> {
    return this.http.post<Incidencia>(this.apiUrl, incidencia);
  }

  duplicate(id: number): Observable<Incidencia> {
    return this.http.post<Incidencia>(`${this.apiUrl}/${id}/duplicate`, {});
  }

  update(id: number, incidencia: Partial<Incidencia>): Observable<Incidencia> {
    return this.http.patch<Incidencia>(`${this.apiUrl}/${id}`, incidencia);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  exportExcel(filters?: any): Observable<Blob> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key]);
        }
      });
    }
    return this.http.get(`${this.apiUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
