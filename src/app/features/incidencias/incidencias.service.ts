import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Incidencia, IncidenciaFiltros } from './interfaces';
import { environment } from '@env';

/** Parámetros de consulta con los filtros que tienen valor. */
function filtrosAParams(filters?: Partial<IncidenciaFiltros>): HttpParams {
  let params = new HttpParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
    }
  }
  return params;
}

@Service()
export class IncidenciasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/incidencias`;

  getAll(filters?: Partial<IncidenciaFiltros>): Observable<Incidencia[]> {
    return this.http.get<Incidencia[]>(this.apiUrl, { params: filtrosAParams(filters) });
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

  exportExcel(filters?: Partial<IncidenciaFiltros>): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export`, {
      params: filtrosAParams(filters),
      responseType: 'blob',
    });
  }
}
