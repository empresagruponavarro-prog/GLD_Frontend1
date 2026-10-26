import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';

export interface AmbienteItem {
  id: number;
  codigo: string;
  descripcion: string;
  estado: boolean;
}

export interface CreateAmbientePayload {
  codigo: string;
  descripcion: string;
  estado?: boolean;
}

export interface UpdateAmbientePayload {
  descripcion?: string;
  estado?: boolean;
}

@Service()
export class AmbientesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/maestros/ambiente`;

  getAll(activos?: boolean): Observable<AmbienteItem[]> {
    const params = activos !== undefined ? { activos: String(activos) } : undefined;
    return this.http.get<AmbienteItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<AmbienteItem> {
    return this.http.get<AmbienteItem>(`${this.apiUrl}/${id}`);
  }

  create(payload: CreateAmbientePayload): Observable<AmbienteItem> {
    return this.http.post<AmbienteItem>(this.apiUrl, payload);
  }

  update(id: number, payload: UpdateAmbientePayload): Observable<AmbienteItem> {
    return this.http.patch<AmbienteItem>(`${this.apiUrl}/${id}`, payload);
  }

  toggleEstado(id: number, estado: boolean): Observable<AmbienteItem> {
    return this.http.patch<AmbienteItem>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
