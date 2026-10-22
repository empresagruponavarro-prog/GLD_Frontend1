import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Area } from '../../requerimientos/requerimientos.models';

@Service()
export class AreasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/area`;

  getAll(): Observable<Area[]> {
    return this.http.get<Area[]>(this.apiUrl);
  }

  create(data: { codigo: string; nombre: string }): Observable<Area> {
    return this.http.post<Area>(this.apiUrl, data);
  }

  update(id: Area['id'], data: { nombre: string; estado: boolean }): Observable<Area> {
    return this.http.patch<Area>(`${this.apiUrl}/${id}`, data);
  }
}
