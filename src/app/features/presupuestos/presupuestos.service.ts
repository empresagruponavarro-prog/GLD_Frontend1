import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  PresupuestoPrincipal, 
  CategoriaFaseMaestra, 
  FaseAsignada, 
  Historial,
  PaginatedResponse,
  PresupuestoCompleto
} from './interfaces';
import { environment } from '@env';

export * from './interfaces';

@Service()
export class PresupuestosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/presupuestos`;

  // Presupuestos Principales
  getPresupuestos(
    page?: number, 
    pageSize?: number, 
    search?: string, 
    codCentroCto?: string,
    idCentroCosto?: number | string
  ): Observable<PaginatedResponse | PresupuestoPrincipal[]> {
    let params = new HttpParams();
    if (page) params = params.set('page', page.toString());
    if (pageSize) params = params.set('pageSize', pageSize.toString());
    if (search?.trim()) params = params.set('search', search.trim());
    if (idCentroCosto !== undefined && idCentroCosto !== null && idCentroCosto !== '') {
      params = params.set('id_centro_costo', idCentroCosto.toString());
    }
    if (codCentroCto?.trim()) {
      params = params.set('CodCentroCto', codCentroCto.trim());
    }

    return this.http.get<PaginatedResponse | PresupuestoPrincipal[]>(this.apiUrl, { params });
  }

  getPresupuestoCompleto(id: string | number): Observable<PresupuestoCompleto> {
    return this.http.get<PresupuestoCompleto>(`${this.apiUrl}/${id}/completo`);
  }

  createPresupuesto(data: Partial<PresupuestoPrincipal>): Observable<PresupuestoPrincipal> {
    const payload = this.sanitizePresupuestoPayload(data);
    return this.http.post<PresupuestoPrincipal>(this.apiUrl, payload);
  }

  updatePresupuesto(id: string | number, data: Partial<PresupuestoPrincipal>): Observable<PresupuestoPrincipal> {
    const payload = this.sanitizePresupuestoPayload(data);
    return this.http.patch<PresupuestoPrincipal>(`${this.apiUrl}/${id}`, payload);
  }

  deletePresupuesto(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private sanitizePresupuestoPayload(data: Partial<PresupuestoPrincipal>): any {
    const payload: any = { ...data };
    if (payload.id_empresa === undefined && payload.CodEmpresa) {
      const num = Number(payload.CodEmpresa);
      if (!isNaN(num) && num > 0) payload.id_empresa = num;
    }
    if (payload.periodo === undefined && payload.IdPeriodo) {
      payload.periodo = String(payload.IdPeriodo);
    }
    if (payload.id_centro_costo === undefined && payload.CodCentroCto) {
      const num = Number(payload.CodCentroCto);
      if (!isNaN(num) && num > 0) payload.id_centro_costo = num;
    }
    return payload;
  }

  // Fases Maestras
  // Fases Maestras
  getFasesMaestras(params?: {
    id_centro_costo?: number;
    id_centro_costos_principal?: number;
    CodCentroCtoPrincipal?: string;
    id_empresa?: number;
    pageSize?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.id_centro_costo != null) httpParams = httpParams.set('id_centro_costo', params.id_centro_costo.toString());
      if (params.id_centro_costos_principal != null) httpParams = httpParams.set('id_centro_costos_principal', params.id_centro_costos_principal.toString());
      if (params.CodCentroCtoPrincipal) httpParams = httpParams.set('CodCentroCtoPrincipal', params.CodCentroCtoPrincipal);
      if (params.id_empresa != null) httpParams = httpParams.set('id_empresa', params.id_empresa.toString());
      if (params.pageSize != null) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (!httpParams.has('pageSize')) {
      httpParams = httpParams.set('pageSize', '100');
    }
    return this.http.get<any>(`${this.apiUrl}/fases-maestras`, { params: httpParams });
  }

    getCategoriasFasesMaestras(page: number = 1): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/categorias-fases-maestras?page=${page}&pageSize=100`);
  }

  getCategoriasDeFase(idFase: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/fases-maestras/${encodeURIComponent(idFase)}/categorias`);
  }

  createCategoriaFaseMaestra(data: { IdpptoFaseCategoria: string; IdpptoFase: string; Descripcion: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/categorias-fases-maestras`, data);
  }

  createFaseMaestra(data: Partial<CategoriaFaseMaestra>): Observable<CategoriaFaseMaestra> {
    return this.http.post<CategoriaFaseMaestra>(`${this.apiUrl}/fases-maestras`, data);
  }

  updateFaseMaestra(id: number | string, data: Partial<CategoriaFaseMaestra>): Observable<CategoriaFaseMaestra> {
    return this.http.patch<CategoriaFaseMaestra>(`${this.apiUrl}/fases-maestras/${id}`, data);
  }

  deleteFaseMaestra(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/fases-maestras/${id}`);
  }

  // Fases Asignadas
  getFasesAsignadas(): Observable<FaseAsignada[]> {
    return this.http.get<FaseAsignada[]>(`${this.apiUrl}/fases-asignadas`);
  }

  createFaseAsignada(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/fases-asignadas`, data);
  }

  updateFaseAsignada(id: number | string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/fases-asignadas/${id}`, data);
  }

  deleteFaseAsignada(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/fases-asignadas/${id}`);
  }

  // Categorías Asignadas
  getCategoriasAsignadas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/categorias-asignadas`);
  }

  createCategoriaAsignada(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/categorias-asignadas`, data);
  }

  updateCategoriaAsignada(id: number | string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/categorias-asignadas/${id}`, data);
  }

  deleteCategoriaAsignada(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categorias-asignadas/${id}`);
  }

  // Historial Versiones
  getHistorial(): Observable<Historial[]> {
    return this.http.get<Historial[]>(`${this.apiUrl}/historial-versiones`);
  }

  createHistorial(data: Partial<Historial>): Observable<Historial> {
    return this.http.post<Historial>(`${this.apiUrl}/historial-versiones`, data);
  }
}
