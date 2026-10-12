import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  DeduccionesPayload,
  DocumentoAdmin,
  DocumentoDetalle,
  DocumentoDirectoPayload,
  DocumentoQuery,
  Paginated,
} from './administracion.models';

export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  });
  return params;
}

@Service()
export class AdministracionDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/administracion/documentos-origen`;

  getAll(query: DocumentoQuery = {}): Observable<Paginated<DocumentoAdmin>> {
    return this.http.get<Paginated<DocumentoAdmin>>(this.api, { params: toParams(query) });
  }
  getById(id: number): Observable<DocumentoDetalle> {
    return this.http.get<DocumentoDetalle>(`${this.api}/${id}`);
  }
  getExpediente(id: number): Observable<unknown> {
    return this.http.get<unknown>(`${this.api}/${id}/expediente`);
  }
  crearDirecto(data: DocumentoDirectoPayload): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.api}/directo`, data);
  }
  actualizarDeducciones(id: number, data: DeduccionesPayload): Observable<DocumentoDetalle> {
    return this.http.patch<DocumentoDetalle>(`${this.api}/${id}/deducciones`, data);
  }
  anular(id: number, motivo?: string): Observable<DocumentoDetalle> {
    return this.http.post<DocumentoDetalle>(`${this.api}/${id}/anular`, { motivo });
  }
}
