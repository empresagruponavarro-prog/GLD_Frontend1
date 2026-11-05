import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  PeriodoFiscal,
  PlanoDeTipoPayload,
  TipoPlano,
  TipoPlanoPayload,
  TipoProyecto,
  TipoProyectoPayload,
} from './catalogos.models';

@Service()
export class CatalogosProyectoService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/proyectos/catalogos`;

  // ─── Tipos de proyecto ─────────────────────────────────────────────────────
  getTiposProyecto(): Observable<TipoProyecto[]> {
    return this.#http.get<TipoProyecto[]>(`${this.#base}/tipos-proyecto`);
  }
  createTipoProyecto(payload: TipoProyectoPayload): Observable<TipoProyecto> {
    return this.#http.post<TipoProyecto>(`${this.#base}/tipos-proyecto`, payload);
  }
  updateTipoProyecto(id: number, payload: Partial<TipoProyectoPayload & { activo: boolean }>): Observable<TipoProyecto> {
    return this.#http.patch<TipoProyecto>(`${this.#base}/tipos-proyecto/${id}`, payload);
  }
  /** Reemplaza la lista de planos del tipo. */
  setPlanosTipoProyecto(id: number, planos: PlanoDeTipoPayload[]): Observable<TipoProyecto> {
    return this.#http.put<TipoProyecto>(`${this.#base}/tipos-proyecto/${id}/planos`, { planos });
  }
  deleteTipoProyecto(id: number): Observable<unknown> {
    return this.#http.delete(`${this.#base}/tipos-proyecto/${id}`);
  }

  // ─── Tipos de plano ────────────────────────────────────────────────────────
  getTiposPlano(): Observable<TipoPlano[]> {
    return this.#http.get<TipoPlano[]>(`${this.#base}/tipos-plano`);
  }
  createTipoPlano(payload: TipoPlanoPayload): Observable<TipoPlano> {
    return this.#http.post<TipoPlano>(`${this.#base}/tipos-plano`, payload);
  }
  updateTipoPlano(id: number, payload: Partial<Omit<TipoPlanoPayload, 'codigo'> & { activo: boolean }>): Observable<TipoPlano> {
    return this.#http.patch<TipoPlano>(`${this.#base}/tipos-plano/${id}`, payload);
  }
  deleteTipoPlano(id: number): Observable<unknown> {
    return this.#http.delete(`${this.#base}/tipos-plano/${id}`);
  }

  // ─── Años fiscales ─────────────────────────────────────────────────────────
  getPeriodos(): Observable<PeriodoFiscal[]> {
    return this.#http.get<PeriodoFiscal[]>(`${this.#base}/periodos`);
  }
  /** Crea el año si no existe, o lo activa/desactiva. */
  setPeriodo(anio: number, activo: boolean): Observable<PeriodoFiscal> {
    return this.#http.put<PeriodoFiscal>(`${this.#base}/periodos/${anio}`, { activo });
  }
}
