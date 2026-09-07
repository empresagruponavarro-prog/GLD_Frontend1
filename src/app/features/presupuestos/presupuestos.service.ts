import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PresupuestoPrincipal, CategoriaFaseMaestra, FaseAsignada, HistorialVersion } from './presupuestos.interface';

@Injectable({
  providedIn: 'root',
})
export class PresupuestosService {
  private apiUrl = 'http://localhost:3000/presupuestos';

  constructor(private http: HttpClient) {}

  // Presupuestos Principales
  getPresupuestos(): Observable<PresupuestoPrincipal[]> {
    return this.http.get<PresupuestoPrincipal[]>(this.apiUrl);
  }

  createPresupuesto(data: Partial<PresupuestoPrincipal>): Observable<PresupuestoPrincipal> {
    return this.http.post<PresupuestoPrincipal>(this.apiUrl, data);
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
  getHistorial(): Observable<HistorialVersion[]> {
    return this.http.get<HistorialVersion[]>(`${this.apiUrl}/historial-versiones`);
  }

  createHistorial(data: Partial<HistorialVersion>): Observable<HistorialVersion> {
    return this.http.post<HistorialVersion>(`${this.apiUrl}/historial-versiones`, data);
  }
}
