import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  ObraCockpit,
  ObraDatosGenerales,
  CreateResidentePayload,
  UpdateAvancePayload,
  UpdateGeneralesPayload,
} from './obra.interface';

@Injectable({
  providedIn: 'root',
})
export class ObraService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/operaciones/obra`;

  /** Obtiene la vista panorámica consolidada del Centro de Costo */
  getCockpit(idCentroCosto: number): Observable<ObraCockpit> {
    return this.http.get<ObraCockpit>(`${this.baseUrl}/${idCentroCosto}/cockpit`);
  }

  /** Actualiza la ficha técnica de la obra */
  updateGenerales(idCentroCosto: number, payload: UpdateGeneralesPayload): Observable<ObraDatosGenerales> {
    return this.http.patch<ObraDatosGenerales>(`${this.baseUrl}/${idCentroCosto}/generales`, payload);
  }

  /** Actualiza el % de avance de una semana (recalcula KPIs y Curva S) */
  updateAvanceSemanal(idCentroCosto: number, idSemana: number, payload: UpdateAvancePayload): Observable<ObraCockpit> {
    return this.http.patch<ObraCockpit>(`${this.baseUrl}/${idCentroCosto}/cronograma/${idSemana}/avance`, payload);
  }

  /** Asigna un nuevo residente o personal técnico */
  createResidente(idCentroCosto: number, payload: CreateResidentePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/${idCentroCosto}/residentes`, payload);
  }

  /** Elimina un residente de la obra */
  deleteResidente(idCentroCosto: number, idResidente: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${idCentroCosto}/residentes/${idResidente}`);
  }
}
