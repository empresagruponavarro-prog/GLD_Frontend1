import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario } from './interfaces';

export * from './interfaces';

@Service()
export class UsuariosService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/administration/usuarios';

  getAll(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  create(data: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, data);
  }

  update(id: string, data: Partial<Usuario>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
