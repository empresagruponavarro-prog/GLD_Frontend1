import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { CuerpoDestino } from './ubicacion-destino/ubicacion-destino.util';
import {
  EquipoAsignado,
  EquipoInventario,
  MovimientoEquipo,
  NuevaAsignacion,
  NuevoActivo,
  OpcionesEquipo,
} from './interfaces/equipo-asignado.interface';

@Service()
export class EquiposTrabajadorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/maestros/anexo`;

  /** Todos los equipos (asignados o no) para el tablero de equipos tecnológicos. */
  getInventario(): Observable<EquipoInventario[]> {
    return this.http.get<EquipoInventario[]>(`${this.baseUrl}/equipos/inventario`);
  }

  /** Registra un activo en el inventario (con o sin trabajador). */
  registrarActivo(body: NuevoActivo): Observable<EquipoInventario> {
    return this.http.post<EquipoInventario>(`${this.baseUrl}/equipos`, body);
  }

  /** Entrega a un trabajador un equipo disponible. */
  asignarActivo(equipoId: number, body: { anexoId: number; fechaAsignacion: string }): Observable<EquipoInventario> {
    return this.http.patch<EquipoInventario>(`${this.baseUrl}/equipos/${equipoId}/asignar`, body);
  }

  getEquiposPorAnexo(anexoId: number): Observable<EquipoAsignado[]> {
    return this.http.get<EquipoAsignado[]>(`${this.baseUrl}/${anexoId}/equipos`);
  }

  asignarEquipo(anexoId: number, body: NuevaAsignacion): Observable<EquipoAsignado> {
    return this.http.post<EquipoAsignado>(`${this.baseUrl}/${anexoId}/equipos`, body);
  }

  /** Catálogo de activos fijos y árbol Local → Nivel → Ambiente (solo combinaciones válidas). */
  getOpciones(): Observable<OpcionesEquipo> {
    return this.http.get<OpcionesEquipo>(`${this.baseUrl}/equipos/opciones`);
  }

  reasignarEquipo(
    anexoId: number,
    equipoId: number,
    body: { anexoDestinoId: number; fechaAsignacion: string } & Partial<CuerpoDestino>,
  ): Observable<EquipoAsignado> {
    return this.http.patch<EquipoAsignado>(`${this.baseUrl}/${anexoId}/equipos/${equipoId}/reasignar`, body);
  }

  devolverEquipo(anexoId: number, equipoId: number, fecha: string): Observable<EquipoAsignado> {
    return this.http.patch<EquipoAsignado>(`${this.baseUrl}/${anexoId}/equipos/${equipoId}/devolver`, { fecha });
  }

  /** Hoja «Entrega de equipos» (.docx) de quien recibe; sin `ids` incluye todos sus equipos. */
  descargarEntrega(anexoId: number, ids: number[], fecha?: string): Observable<Blob> {
    let params = new HttpParams();
    if (ids.length > 0) params = params.set('ids', ids.join(','));
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get(`${this.baseUrl}/${anexoId}/equipos/entrega`, { params, responseType: 'blob' });
  }

  getHistorial(equipoId: number): Observable<MovimientoEquipo[]> {
    return this.http.get<MovimientoEquipo[]>(`${this.baseUrl}/equipos/${equipoId}/historial`);
  }
}
