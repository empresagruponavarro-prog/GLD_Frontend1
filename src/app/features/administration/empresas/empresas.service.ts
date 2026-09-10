import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empresa } from './interfaces';

@Service()
export class EmpresasService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/administration/empresas';

  getAll(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.apiUrl);
  }

  create(data: Empresa): Observable<Empresa> {
    return this.http.post<Empresa>(this.apiUrl, data);
  }

  update(codEmpresa: string, data: Partial<Empresa>): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.apiUrl}/${codEmpresa}`, data);
  }

  delete(codEmpresa: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${codEmpresa}`);
  }
}
