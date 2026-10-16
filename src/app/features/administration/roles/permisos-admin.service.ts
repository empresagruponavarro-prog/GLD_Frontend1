import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { GrupoCatalogo, GuardarPermisosRol, MatrizPermisosRol } from '@app/core/auth/permisos.models';

/** Catálogo de módulos y matriz de permisos por rol (solo Administrador). No confundir con `core/auth/PermisosService` (permisos de la sesión). */
@Service()
export class PermisosAdminService {
  readonly #http = inject(HttpClient);
  readonly #api = `${environment.apiUrl}/administration`;

  /** Grupos → módulos, ya ordenados por el backend. */
  catalogo(): Observable<GrupoCatalogo[]> {
    return this.#http.get<GrupoCatalogo[]>(`${this.#api}/permisos/catalogo`);
  }

  /** Matriz del rol: una fila por módulo del catálogo. */
  matriz(rolId: number): Observable<MatrizPermisosRol> {
    return this.#http.get<MatrizPermisosRol>(`${this.#api}/roles/${rolId}/permisos`);
  }

  /**
   * Reemplaza la matriz completa (una fila por cada módulo del catálogo). 400 si falta o sobra una
   * clave, si marca aprobar/anular donde no se admite o si hay acciones sin `ver`; 409 para el Administrador.
   */
  guardar(rolId: number, body: GuardarPermisosRol): Observable<MatrizPermisosRol> {
    return this.#http.put<MatrizPermisosRol>(`${this.#api}/roles/${rolId}/permisos`, body);
  }
}
