import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Anexo, AnexoPaginated, AnexoQuery } from './interfaces/anexos.interface';

@Service()
export class AnexosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/anexo`;

  getAll(query: AnexoQuery = {}): Observable<AnexoPaginated> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<AnexoPaginated>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Anexo> {
    return this.http.get<Anexo>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<Anexo>): Observable<Anexo> {
    return this.http.post<Anexo>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Anexo>): Observable<Anexo> {
    return this.http.patch<Anexo>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
