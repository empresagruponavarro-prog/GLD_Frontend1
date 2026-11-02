import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import type { Observable } from 'rxjs';
import type { Area } from '../../requerimientos/requerimientos.models';

/** Persona que puede ser jefe o gerente de un área (trabajador registrado). */
export interface TrabajadorOpcion {
  id: number;
  nombre: string | null;
}

/** Acceso HTTP al maestro de áreas (`/maestros/area`). El código lo asigna el sistema. */
@Service()
export class AreasService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/maestros/area`;

  getAll(): Observable<Area[]> {
    return this.http.get<Area[]>(this.api);
  }

  getTrabajadores(): Observable<TrabajadorOpcion[]> {
    return this.http.get<TrabajadorOpcion[]>(`${environment.apiUrl}/maestros/anexo/select`, {
      params: new HttpParams().set('tipoAnexo', 'Trabajador'),
    });
  }

  create(data: { nombre: string; descripcion?: string; idJefe?: number }): Observable<Area> {
    return this.http.post<Area>(this.api, data);
  }

  update(id: number, data: { nombre: string; estado: boolean; descripcion: string; idJefe: number }): Observable<Area> {
    return this.http.patch<Area>(`${this.api}/${id}`, data);
  }
}
