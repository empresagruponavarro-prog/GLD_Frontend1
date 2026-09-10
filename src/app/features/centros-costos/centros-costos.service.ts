import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CentroCosto } from './interfaces';
import { environment } from '@env';

@Service()
export class CentrosCostosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/centros-costos`;

  getAll(): Observable<CentroCosto[]> {
    return this.http.get<CentroCosto[]>(this.apiUrl);
  }

  getCatalogosFiltros(): Observable<{ empresas: string[]; clientes: string[] }> {
    return this.http.get<{ empresas: string[]; clientes: string[] }>(`${this.apiUrl}/catalogos-filtros`);
  }

  create(data: CentroCosto): Observable<CentroCosto> {
    return this.http.post<CentroCosto>(this.apiUrl, data);
  }

  update(cod: string, data: Partial<CentroCosto>): Observable<CentroCosto> {
    return this.http.patch<CentroCosto>(`${this.apiUrl}/${cod}`, data);
  }

  delete(cod: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${cod}`);
  }
}
