import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AdjudicacionPayload,
  AdjudicacionResponse,
  CompromisosPresupuesto,
  Conciliacion,
  CuadroComparativoPpto,
  PptoCotizacion,
  PptoCotizacionPayload,
} from './cotizaciones-ppto.models';

/**
 * Cotizaciones por ítem del presupuesto Meta, su cuadro comparativo, la adjudicación y los compromisos (FUR y órdenes) que se generan
 * al grabar (plan 09). El presupuesto se identifica por su `id` numérico.
 */
@Service()
export class CotizacionesPptoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/presupuestos`;

  getCotizaciones(idPresupuesto: number, idDetalleFase?: number): Observable<PptoCotizacion[]> {
    let params = new HttpParams();
    if (idDetalleFase !== undefined) params = params.set('id_detalle_fase', String(idDetalleFase));
    return this.http.get<PptoCotizacion[]>(`${this.api}/${idPresupuesto}/cotizaciones`, { params });
  }

  createCotizacion(idPresupuesto: number, data: PptoCotizacionPayload): Observable<PptoCotizacion> {
    return this.http.post<PptoCotizacion>(`${this.api}/${idPresupuesto}/cotizaciones`, data);
  }

  updateCotizacion(idPresupuesto: number, idCotizacion: number, data: Partial<PptoCotizacionPayload>): Observable<PptoCotizacion> {
    return this.http.patch<PptoCotizacion>(`${this.api}/${idPresupuesto}/cotizaciones/${idCotizacion}`, data);
  }

  deleteCotizacion(idPresupuesto: number, idCotizacion: number): Observable<{ deleted: boolean; id: number; compromisos: Conciliacion }> {
    return this.http.delete<{ deleted: boolean; id: number; compromisos: Conciliacion }>(`${this.api}/${idPresupuesto}/cotizaciones/${idCotizacion}`);
  }

  getCuadro(idPresupuesto: number, idDetalleFase: number): Observable<CuadroComparativoPpto> {
    const params = new HttpParams().set('id_detalle_fase', String(idDetalleFase));
    return this.http.get<CuadroComparativoPpto>(`${this.api}/${idPresupuesto}/cuadro-comparativo`, { params });
  }

  adjudicar(idPresupuesto: number, data: AdjudicacionPayload): Observable<AdjudicacionResponse> {
    return this.http.put<AdjudicacionResponse>(`${this.api}/${idPresupuesto}/adjudicacion`, data);
  }

  getCompromisos(idPresupuesto: number): Observable<CompromisosPresupuesto> {
    return this.http.get<CompromisosPresupuesto>(`${this.api}/${idPresupuesto}/compromisos`);
  }
}
