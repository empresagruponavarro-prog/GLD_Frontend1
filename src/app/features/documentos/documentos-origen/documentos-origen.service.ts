import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env';
import { CreateDocumentoOrigen, DocumentoOrigen, DocumentoOrigenDetalle, DocumentoOrigenPaginated, DocumentoOrigenQuery, DocumentoOrigenDetalleLinea } from './interfaces/documentos-origen.interface';

@Service()
export class DocumentosOrigenService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/documentos/origen`;

  getAll(query: DocumentoOrigenQuery = {}): Observable<DocumentoOrigenPaginated> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    const filtros: DocumentoOrigenQuery = { ...query };
    delete filtros.page;
    delete filtros.pageSize;

    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((res: any): DocumentoOrigenPaginated => {
        const items: DocumentoOrigen[] = Array.isArray(res)
          ? res
          : (res?.items ?? res?.data ?? []);
        const total = Array.isArray(res)
          ? res.length
          : (res?.total ?? res?.meta?.total ?? items.length);

        return {
          data: items,
          total,
          page: res?.page ?? res?.meta?.page ?? page,
          pageSize: res?.pageSize ?? res?.meta?.pageSize ?? pageSize,
          totalPages: res?.totalPages ?? res?.meta?.totalPages ?? (Math.ceil(total / pageSize) || 1),
        };
      })
    );
  }

  getById(id: number): Observable<DocumentoOrigenDetalle> {
    return this.http.get<DocumentoOrigenDetalle>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateDocumentoOrigen): Observable<DocumentoOrigen> {
    return this.http.post<DocumentoOrigen>(this.apiUrl, data);
  }

  update(id: number, data: CreateDocumentoOrigen): Observable<DocumentoOrigen> {
    return this.http.patch<DocumentoOrigen>(`${this.apiUrl}/${id}`, data);
  }

  getDetallePorFase(idCentroCosto?: number, idFase?: number): Observable<DocumentoOrigenDetalleLinea[]> {
    let params = new HttpParams();
    if (idCentroCosto) params = params.set('id_centro_costo', idCentroCosto.toString());
    if (idFase) params = params.set('id_fase', idFase.toString());
    return this.http.get<DocumentoOrigenDetalleLinea[]>(`${this.apiUrl}/detalle-por-fase`, { params });
  }
}
