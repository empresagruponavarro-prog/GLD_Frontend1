import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Anexo, AnexoPaginated, AnexoQuery, AnexoSelect, SelectOption, TipoAnexo } from './interfaces/anexos.interface';

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

  getSelect(tipoAnexo?: TipoAnexo): Observable<AnexoSelect[]> {
    let params = new HttpParams();
    if (tipoAnexo) {
      params = params.set('tipoAnexo', tipoAnexo);
    }
    return this.http.get<AnexoSelect[]>(`${this.apiUrl}/select`, { params });
  }

  getEspecialidadesSelect(tipoAnexo?: TipoAnexo): Observable<SelectOption[]> {
    let params = new HttpParams();
    if (tipoAnexo) {
      params = params.set('tipoAnexo', tipoAnexo);
    }
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/especialidad/select`, { params });
  }

  getTiposDocIdeSelect(tipoAnexo?: TipoAnexo): Observable<SelectOption[]> {
    let params = new HttpParams();
    if (tipoAnexo) {
      params = params.set('tipoAnexo', tipoAnexo);
    }
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/tipo-doc-identidad/select`, { params });
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
