import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AreaOpcion,
  OpcionSelect,
  OpcionesTrabajador,
  ResumenTrabajadores,
  Trabajador,
  TrabajadorGuardar,
  TrabajadorQuery,
  TrabajadoresPaginados,
} from './trabajadores.models';

/** Acceso HTTP a RR.HH. › Trabajadores (`/rrhh/trabajadores`) y a los catálogos que usa su formulario. */
@Service()
export class TrabajadoresService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/rrhh/trabajadores`;

  getAll(query: TrabajadorQuery = {}): Observable<TrabajadoresPaginados> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<TrabajadoresPaginados>(this.api, { params });
  }

  create(data: TrabajadorGuardar): Observable<Trabajador> {
    return this.http.post<Trabajador>(this.api, data);
  }

  update(id: number, data: Partial<TrabajadorGuardar>): Observable<Trabajador> {
    return this.http.patch<Trabajador>(`${this.api}/${id}`, data);
  }

  /** Conteos para las tarjetas: total, activos, de baja, ficha pendiente y documento pendiente. */
  getResumen(): Observable<ResumenTrabajadores> {
    return this.http.get<ResumenTrabajadores>(`${this.api}/resumen`);
  }

  /** Tipos de documento de trabajador, tipos de trabajador y modalidades de contrato (con su estado). */
  getOpciones(): Observable<OpcionesTrabajador> {
    return this.http.get<OpcionesTrabajador>(`${this.api}/opciones`);
  }

  /** Áreas activas, para elegir el área de trabajo. */
  getAreas(): Observable<AreaOpcion[]> {
    return this.http.get<AreaOpcion[]>(`${environment.apiUrl}/maestros/area`, { params: new HttpParams().set('activas', 'true') });
  }

  /** Especialidades válidas para trabajadores. */
  getEspecialidades(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${environment.apiUrl}/maestros/especialidad/select`, {
      params: new HttpParams().set('tipoAnexo', 'Trabajador'),
    });
  }
}
