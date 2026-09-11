import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Especialidad, EspecialidadPaginated, EspecialidadQuery } from './interfaces/especialidades.interface';

@Service()
export class EspecialidadesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/especialidad`;

  getAll(query: EspecialidadQuery = {}): Observable<EspecialidadPaginated> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<EspecialidadPaginated>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Especialidad> {
    return this.http.get<Especialidad>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<Especialidad>): Observable<Especialidad> {
    return this.http.post<Especialidad>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Especialidad>): Observable<Especialidad> {
    return this.http.patch<Especialidad>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
