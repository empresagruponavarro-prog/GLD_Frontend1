import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empresa } from './empresas.interface';

export * from './empresas.interface';

@Injectable({
  providedIn: 'root',
})
export class EmpresasService {
  private apiUrl = 'http://localhost:3000/administration/empresas';

  constructor(private http: HttpClient) {}

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
