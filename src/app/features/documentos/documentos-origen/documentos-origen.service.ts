import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

    // El backend responde `Paginated<DocumentoOrigenResponseDto>` ({ data, total, page, pageSize, totalPages }).
    return this.http.get<DocumentoOrigenPaginated>(this.apiUrl, { params });
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

  delete(id: number): Observable<{ deleted: boolean; id: number }> {
    return this.http.delete<{ deleted: boolean; id: number }>(`${this.apiUrl}/${id}`);
  }

  getDetallePorFase(idCentroCosto?: number, idFase?: number): Observable<DocumentoOrigenDetalleLinea[]> {
    let params = new HttpParams();
    if (idCentroCosto) params = params.set('id_centro_costo', idCentroCosto.toString());
    if (idFase) params = params.set('id_fase', idFase.toString());
    return this.http.get<DocumentoOrigenDetalleLinea[]>(`${this.apiUrl}/detalle-por-fase`, { params });
  }
}
