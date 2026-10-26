import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CreateLocalPayload,
  LocalItem,
  UpdateLocalPayload,
} from './locales.interface';

@Service()
export class LocalesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/maestros/local`;

  getAll(activos?: boolean): Observable<LocalItem[]> {
    const params = activos !== undefined ? { activos: String(activos) } : undefined;
    return this.http.get<LocalItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<LocalItem> {
    return this.http.get<LocalItem>(`${this.apiUrl}/${id}`);
  }

  create(payload: CreateLocalPayload): Observable<LocalItem> {
    return this.http.post<LocalItem>(this.apiUrl, payload);
  }

  update(id: number, payload: UpdateLocalPayload): Observable<LocalItem> {
    return this.http.patch<LocalItem>(`${this.apiUrl}/${id}`, payload);
  }

  toggleEstado(id: number, estado: boolean): Observable<LocalItem> {
    return this.http.patch<LocalItem>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
