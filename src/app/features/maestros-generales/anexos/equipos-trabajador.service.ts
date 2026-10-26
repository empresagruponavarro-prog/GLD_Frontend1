import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { EquipoAsignado, NuevaAsignacion, OpcionesEquipo } from './interfaces/equipo-asignado.interface';

@Service()
export class EquiposTrabajadorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/maestros/anexo`;

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
    body: { anexoDestinoId: number; fechaAsignacion: string },
  ): Observable<EquipoAsignado> {
    return this.http.patch<EquipoAsignado>(`${this.baseUrl}/${anexoId}/equipos/${equipoId}/reasignar`, body);
  }

  devolverEquipo(anexoId: number, equipoId: number): Observable<EquipoAsignado> {
    return this.http.patch<EquipoAsignado>(`${this.baseUrl}/${anexoId}/equipos/${equipoId}/devolver`, {});
  }
}
