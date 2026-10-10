import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '@env';
import {
  AprobarPayload,
  ItemCatalogo,
  Paginated,
  Requerimiento,
  RequerimientoPayload,
  RequerimientoQuery,
  SelectOption,
} from './requerimientos.models';

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  });
  return params;
}

@Service()
export class RequerimientosService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/requerimientos`;

  getAll(query: RequerimientoQuery = {}): Observable<Paginated<Requerimiento>> {
    return this.http.get<Paginated<Requerimiento>>(this.api, { params: toParams(query) });
  }
  getPendientesOc(): Observable<Requerimiento[]> {
    return this.http.get<Requerimiento[]>(`${this.api}/pendientes-oc`);
  }
  getById(id: number): Observable<Requerimiento> {
    return this.http.get<Requerimiento>(`${this.api}/${id}`);
  }
  create(data: RequerimientoPayload): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(this.api, data);
  }
  update(id: number, data: Partial<RequerimientoPayload>): Observable<Requerimiento> {
    return this.http.patch<Requerimiento>(`${this.api}/${id}`, data);
  }
  delete(id: number): Observable<{ deleted: boolean; id: number }> {
    return this.http.delete<{ deleted: boolean; id: number }>(`${this.api}/${id}`);
  }

  // ---- Flujo de aprobación
  enviar(id: number, comentario?: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/enviar`, { comentario });
  }
  observar(id: number, idAprobador: number, comentario: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/observar`, { id_aprobador: idAprobador, comentario });
  }
  aprobar(id: number, data: AprobarPayload): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/aprobar`, data);
  }
  rechazar(id: number, idAprobador: number, comentario: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/rechazar`, { id_aprobador: idAprobador, comentario });
  }
  anular(id: number, comentario?: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/anular`, { comentario });
  }

  // ---- Catálogos
  getTrabajadoresSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/anexo/select`, { params: toParams({ tipoAnexo: 'Trabajador' }) });
  }
  getCentrosCostosSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/centros-costos/select`);
  }

  /**
   * Busca en el catálogo de productos **y servicios** por código o descripción
   * (el selector de almacén solo trae productos con stock).
   */
  buscarCatalogo(term: string): Observable<ItemCatalogo[]> {
    const url = `${environment.apiUrl}/maestros/producto`;
    const base = { pageSize: 10, estado: true };
    return forkJoin([
      this.http.get<Paginated<ItemCatalogo>>(url, { params: toParams({ ...base, codigo: term }) }),
      this.http.get<Paginated<ItemCatalogo>>(url, { params: toParams({ ...base, descripcion: term }) }),
    ]).pipe(
      map(([porCodigo, porDescripcion]) => {
        const vistos = new Map<number, ItemCatalogo>();
        for (const item of [...porCodigo.data, ...porDescripcion.data]) vistos.set(item.id, item);
        return [...vistos.values()].slice(0, 12);
      }),
    );
  }
}
