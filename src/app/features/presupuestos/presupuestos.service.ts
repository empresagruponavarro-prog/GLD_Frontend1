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
  getPresupuestos(page?: number, pageSize?: number, search?: string): Observable<PaginatedResponse | PresupuestoPrincipal[]> {
    let params = new HttpParams();
    if (page) params = params.set('page', page.toString());
    if (pageSize) params = params.set('pageSize', pageSize.toString());
    if (search?.trim()) params = params.set('search', search.trim());

    return this.http.get<PaginatedResponse | PresupuestoPrincipal[]>(this.apiUrl, { params });
  }

  getPresupuestoCompleto(id: string): Observable<PresupuestoCompleto> {
    return this.http.get<PresupuestoCompleto>(`${this.apiUrl}/${id}/completo`);
  }

  createPresupuesto(data: Partial<PresupuestoPrincipal>): Observable<PresupuestoPrincipal> {
    return this.http.post<PresupuestoPrincipal>(this.apiUrl, data);
  }

  updatePresupuesto(id: string, data: Partial<PresupuestoPrincipal>): Observable<PresupuestoPrincipal> {
    return this.http.patch<PresupuestoPrincipal>(`${this.apiUrl}/${id}`, data);
  }

  deletePresupuesto(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Fases Maestras
  getFasesMaestras(): Observable<CategoriaFaseMaestra[]> {
    return this.http.get<CategoriaFaseMaestra[]>(`${this.apiUrl}/categorias-fases-maestras`);
  }

  createFaseMaestra(data: Partial<CategoriaFaseMaestra>): Observable<CategoriaFaseMaestra> {
    return this.http.post<CategoriaFaseMaestra>(`${this.apiUrl}/categorias-fases-maestras`, data);
  }

  // Fases Asignadas
  getFasesAsignadas(): Observable<FaseAsignada[]> {
    return this.http.get<FaseAsignada[]>(`${this.apiUrl}/fases-asignadas`);
  }

  createFaseAsignada(data: Partial<FaseAsignada>): Observable<FaseAsignada> {
    return this.http.post<FaseAsignada>(`${this.apiUrl}/fases-asignadas`, data);
  }

  // Historial Versiones
  getHistorial(): Observable<Historial[]> {
    return this.http.get<Historial[]>(`${this.apiUrl}/historial-versiones`);
  }

  createHistorial(data: Partial<Historial>): Observable<Historial> {
    return this.http.post<Historial>(`${this.apiUrl}/historial-versiones`, data);
  }
}
