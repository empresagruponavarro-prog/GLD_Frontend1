import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empresa } from './interfaces';
import { environment } from '@env';

@Service()
export class EmpresasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/administration/empresas`;

  getAll(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.apiUrl);
  }

  getById(id: number | string): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.apiUrl}/${id}`);
  }

  create(data: Empresa): Observable<Empresa> {
    return this.http.post<Empresa>(this.apiUrl, data);
  }

  update(id: number | string, data: Partial<Empresa>): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
