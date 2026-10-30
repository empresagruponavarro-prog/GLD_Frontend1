import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';

export interface NivelItem {
  id: number;
  codigo: string;
  descripcion: string;
  estado: boolean;
}

export interface CreateNivelPayload {
  codigo: string;
  descripcion: string;
  estado?: boolean;
}

export interface UpdateNivelPayload {
  descripcion?: string;
  estado?: boolean;
}

@Service()
export class NivelesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/maestros/nivel`;

  getAll(activos?: boolean): Observable<NivelItem[]> {
    const params = activos !== undefined ? { activos: String(activos) } : undefined;
    return this.http.get<NivelItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<NivelItem> {
    return this.http.get<NivelItem>(`${this.apiUrl}/${id}`);
  }

  create(payload: CreateNivelPayload): Observable<NivelItem> {
    return this.http.post<NivelItem>(this.apiUrl, payload);
  }

  update(id: number, payload: UpdateNivelPayload): Observable<NivelItem> {
    return this.http.patch<NivelItem>(`${this.apiUrl}/${id}`, payload);
  }

  toggleEstado(id: number, estado: boolean): Observable<NivelItem> {
    return this.http.patch<NivelItem>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
