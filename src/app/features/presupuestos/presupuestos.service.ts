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
  getFasesMaestras(): Observable<CategoriaFaseMaestra[]> {
    return this.http.get<CategoriaFaseMaestra[]>(`${this.apiUrl}/fases-maestras`);
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

  createFaseAsignada(data: Partial<FaseAsignada>): Observable<FaseAsignada> {
    return this.http.post<FaseAsignada>(`${this.apiUrl}/fases-asignadas`, data);
  }

  updateFaseAsignada(id: number | string, data: Partial<FaseAsignada>): Observable<FaseAsignada> {
    return this.http.patch<FaseAsignada>(`${this.apiUrl}/fases-asignadas/${id}`, data);
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
