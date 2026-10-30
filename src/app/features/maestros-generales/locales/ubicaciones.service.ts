import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CreateUbicacionPayload,
  UbicacionItem,
  UpdateUbicacionPayload,
} from './locales.interface.js';

@Service()
export class UbicacionesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/maestros/ubicacion`;

  getAll(activos?: boolean): Observable<UbicacionItem[]> {
    let params = new HttpParams();
    if (activos !== undefined) {
      params = params.set('activos', String(activos));
    }
    return this.http.get<UbicacionItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<UbicacionItem> {
    return this.http.get<UbicacionItem>(`${this.apiUrl}/${id}`);
  }

  resolver(idLocal: number, idNivel: number, idAmbiente: number): Observable<UbicacionItem | null> {
    const params = new HttpParams()
      .set('id_local', String(idLocal))
      .set('id_nivel', String(idNivel))
      .set('id_ambiente', String(idAmbiente));
    return this.http.get<UbicacionItem | null>(`${this.apiUrl}/resolver`, { params });
  }

  create(payload: CreateUbicacionPayload): Observable<UbicacionItem> {
    return this.http.post<UbicacionItem>(this.apiUrl, payload);
  }

  update(id: number, payload: UpdateUbicacionPayload): Observable<UbicacionItem> {
    return this.http.patch<UbicacionItem>(`${this.apiUrl}/${id}`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleEstado(id: number, estado: boolean): Observable<UbicacionItem> {
    return this.http.patch<UbicacionItem>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
