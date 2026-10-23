import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import type { Observable } from 'rxjs';
import type { Area } from '../../requerimientos/requerimientos.models';

/** Acceso HTTP al maestro de áreas (`/maestros/area`). */
@Service()
export class AreasService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/maestros/area`;

  getAll(): Observable<Area[]> {
    return this.http.get<Area[]>(this.api);
  }

  create(data: { codigo: string; nombre: string }): Observable<Area> {
    return this.http.post<Area>(this.api, data);
  }

  update(id: number, data: { nombre: string; estado: boolean }): Observable<Area> {
    return this.http.patch<Area>(`${this.api}/${id}`, data);
  }
}
