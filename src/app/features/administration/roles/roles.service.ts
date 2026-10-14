import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RolActualizar, RolAdmin, RolCrear } from './interfaces';
import { environment } from '@env';

export * from './interfaces';

/** CRUD del catálogo de roles (`/administration/roles`, solo Administrador). */
@Service()
export class RolesService {
  readonly #http = inject(HttpClient);
  readonly #apiUrl = `${environment.apiUrl}/administration/roles`;

  listarRoles(): Observable<RolAdmin[]> {
    return this.#http.get<RolAdmin[]>(this.#apiUrl);
  }

  crearRol(data: RolCrear): Observable<RolAdmin> {
    return this.#http.post<RolAdmin>(this.#apiUrl, data);
  }

  actualizarRol(id: number, data: RolActualizar): Observable<RolAdmin> {
    return this.#http.patch<RolAdmin>(`${this.#apiUrl}/${id}`, data);
  }

  eliminarRol(id: number): Observable<void> {
    return this.#http.delete<void>(`${this.#apiUrl}/${id}`);
  }
}
