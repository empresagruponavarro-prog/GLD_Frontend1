import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AreaItem,
  GuardarExcepcionesUsuario,
  PermisosUsuario,
  Usuario,
  UsuarioCreateDto,
  UsuarioEstadoDto,
  UsuarioUpdateDto,
} from './interfaces';
import { environment } from '@env';

export * from './interfaces';

@Service()
export class UsuariosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/administration/usuarios`;

  getAll(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  /** Catálogo de roles válidos. */
  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/roles`);
  }

  /** Lista de áreas activas de la empresa para asignación a usuarios. */
  getAreas(): Observable<AreaItem[]> {
    return this.http.get<AreaItem[]>(`${environment.apiUrl}/maestros/area?activas=true`);
  }

  create(data: UsuarioCreateDto): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, data);
  }

  update(id: string, data: UsuarioUpdateDto): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}`, data);
  }

  /** Desactiva o reactiva el usuario. 409 si es uno mismo o si dejaría el sistema sin Administradores activos. */
  cambiarEstado(id: string, activo: boolean): Observable<Usuario> {
    const body: UsuarioEstadoDto = { activo };
    return this.http.patch<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}/estado`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  /** Permisos del usuario módulo por módulo con su origen (rol → área → excepción). */
  getPermisos(id: string): Observable<PermisosUsuario> {
    return this.http.get<PermisosUsuario>(`${this.apiUrl}/${encodeURIComponent(id)}/permisos`);
  }

  /**
   * Reemplaza todas las excepciones del usuario (solo el Administrador). 400 si hay un módulo de Administración,
   * desconocido o repetido, o una acción sin Ver; 409 si es uno mismo o el usuario es Administrador.
   */
  guardarExcepciones(id: string, data: GuardarExcepcionesUsuario): Observable<PermisosUsuario> {
    return this.http.put<PermisosUsuario>(`${this.apiUrl}/${encodeURIComponent(id)}/permisos`, data);
  }

  /** Quita todas las excepciones: el usuario vuelve a lo que dan su rol y su área. */
  restablecerPermisos(id: string): Observable<PermisosUsuario> {
    return this.http.delete<PermisosUsuario>(`${this.apiUrl}/${encodeURIComponent(id)}/permisos`);
  }
}
