import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '@env';
import {
  Area,
  AprobarPayload,
  Cotizacion,
  CotizacionPayload,
  CuadroComparativo,
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
  cerrarCotizacion(id: number, comentario?: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/cerrar-cotizacion`, { comentario });
  }
  reabrirCotizacion(id: number, comentario?: string): Observable<Requerimiento> {
    return this.http.post<Requerimiento>(`${this.api}/${id}/reabrir-cotizacion`, { comentario });
  }

  // ---- Cotizaciones y cuadro comparativo
  getCotizaciones(id: number): Observable<Cotizacion[]> {
    return this.http.get<Cotizacion[]>(`${this.api}/${id}/cotizaciones`);
  }
  createCotizacion(id: number, data: CotizacionPayload): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.api}/${id}/cotizaciones`, data);
  }
  updateCotizacion(id: number, idCot: number, data: Partial<CotizacionPayload>): Observable<Cotizacion> {
    return this.http.patch<Cotizacion>(`${this.api}/${id}/cotizaciones/${idCot}`, data);
  }
  deleteCotizacion(id: number, idCot: number): Observable<{ deleted: boolean; id: number }> {
    return this.http.delete<{ deleted: boolean; id: number }>(`${this.api}/${id}/cotizaciones/${idCot}`);
  }
  getCuadroComparativo(id: number): Observable<CuadroComparativo> {
    return this.http.get<CuadroComparativo>(`${this.api}/${id}/cuadro-comparativo`);
  }

  // ---- Catálogos
  getTrabajadoresSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/anexo/select`, { params: toParams({ tipoAnexo: 'Trabajador' }) });
  }
  getCentrosCostosSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/centros-costos/select`);
  }
  getProveedoresSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/anexo/select`, { params: toParams({ tipoAnexo: 'Proveedor' }) });
  }
  /** Cualquier anexo (beneficiarios: trabajadores, proveedores, contratistas). */
  getAnexosSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/anexo/select`);
  }
  getAreas(soloActivas = true): Observable<Area[]> {
    return this.http.get<Area[]>(`${environment.apiUrl}/maestros/area`, { params: toParams({ activas: soloActivas }) });
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
