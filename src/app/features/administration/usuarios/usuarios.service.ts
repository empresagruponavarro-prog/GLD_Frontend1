import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, UsuarioCreateDto, UsuarioEstadoDto, UsuarioUpdateDto } from './interfaces';
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
}
