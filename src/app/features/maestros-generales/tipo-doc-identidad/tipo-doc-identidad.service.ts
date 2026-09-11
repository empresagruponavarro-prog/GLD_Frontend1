import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { TipoDocIdentidad, TipoDocIdentidadPaginated, TipoDocIdentidadQuery } from './interfaces/tipo-doc-identidad.interface';

@Service()
export class TipoDocIdentidadService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/tipo-doc-identidad`;

  getAll(query: TipoDocIdentidadQuery = {}): Observable<TipoDocIdentidadPaginated> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<TipoDocIdentidadPaginated>(this.apiUrl, { params });
  }

  getById(id: number): Observable<TipoDocIdentidad> {
    return this.http.get<TipoDocIdentidad>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<TipoDocIdentidad>): Observable<TipoDocIdentidad> {
    return this.http.post<TipoDocIdentidad>(this.apiUrl, data);
  }

  update(id: number, data: Partial<TipoDocIdentidad>): Observable<TipoDocIdentidad> {
    return this.http.patch<TipoDocIdentidad>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
