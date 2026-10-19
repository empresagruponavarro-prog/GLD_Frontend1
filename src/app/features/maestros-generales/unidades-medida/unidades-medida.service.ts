import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env';
import type { Paginated } from '@shared/models';
import {
  Equivalencia,
  EquivalenciaGuardar,
  UnidadMedida,
  UnidadMedidaGuardar,
  UnidadMedidaOpcion,
  UnidadMedidaQuery,
} from './unidades-medida.models';

/** Maestro de unidades de medida y sus equivalencias (`/maestros/unidad-medida`). */
@Service()
export class UnidadesMedidaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/maestros/unidad-medida`;

  list(q: UnidadMedidaQuery): Observable<Paginated<UnidadMedida>> {
    let params = new HttpParams().set('page', q.page).set('pageSize', q.pageSize);
    const texto = q.texto.trim();
    if (texto) params = params.set(q.campo, texto);
    if (q.estado !== 'todas') params = params.set('estado', q.estado === 'activas');
    return this.http.get<Paginated<UnidadMedida>>(this.api, { params });
  }

  select(): Observable<UnidadMedidaOpcion[]> {
    return this.http.get<UnidadMedidaOpcion[]>(`${this.api}/select`);
  }

  create(body: UnidadMedidaGuardar): Observable<UnidadMedida> {
    return this.http.post<UnidadMedida>(this.api, body);
  }

  update(id: number, body: Partial<UnidadMedidaGuardar>): Observable<UnidadMedida> {
    return this.http.patch<UnidadMedida>(`${this.api}/${id}`, body);
  }

  /** La API no borra: desactiva la unidad (`estado = false`). */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  /** Cuántos productos del catálogo usan la unidad (solo pide el total). */
  contarProductos(id: number): Observable<number> {
    const params = new HttpParams().set('page', 1).set('pageSize', 1);
    return this.http.get<Paginated<unknown>>(`${this.api}/${id}/productos`, { params }).pipe(map((r) => r.total));
  }

  equivalencias(idOrigen: number): Observable<readonly Equivalencia[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 100);
    return this.http
      .get<Paginated<Equivalencia>>(`${this.api}/${idOrigen}/equivalencias`, { params })
      .pipe(map((r) => r.data));
  }

  crearEquivalencia(idOrigen: number, body: EquivalenciaGuardar): Observable<Equivalencia> {
    return this.http.post<Equivalencia>(`${this.api}/${idOrigen}/equivalencias`, body);
  }

  editarEquivalencia(idOrigen: number, id: number, body: Partial<EquivalenciaGuardar>): Observable<Equivalencia> {
    return this.http.patch<Equivalencia>(`${this.api}/${idOrigen}/equivalencias/${id}`, body);
  }

  /** La API no borra: desactiva la equivalencia (`estado = false`). */
  desactivarEquivalencia(idOrigen: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${idOrigen}/equivalencias/${id}`);
  }
}
