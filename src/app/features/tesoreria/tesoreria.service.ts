import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { DocumentoAdmin, Paginated } from '../documentos/administracion/administracion.models';
import { toParams } from '../documentos/administracion/administracion.service';
import {
  Agenda,
  Cuenta,
  CuentaPayload,
  EjecutarPagoPayload,
  Pago,
  PagoDirectoPayload,
  PagoQuery,
  Programacion,
  ProgramacionItemPayload,
  Resumen,
  ResumenQuery,
  Retenciones,
  TipoCambio,
  TipoCambioVigente,
} from './tesoreria.models';

@Service()
export class TesoreriaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tesoreria`;

  // ---- Cuentas
  getCuentas(soloActivas = false): Observable<Cuenta[]> {
    return this.http.get<Cuenta[]>(`${this.api}/cuentas`, { params: toParams({ activas: soloActivas || undefined }) });
  }
  createCuenta(data: CuentaPayload): Observable<Cuenta> {
    return this.http.post<Cuenta>(`${this.api}/cuentas`, data);
  }
  updateCuenta(id: number, data: CuentaPayload): Observable<Cuenta> {
    return this.http.patch<Cuenta>(`${this.api}/cuentas/${id}`, data);
  }

  // ---- Tipo de cambio
  getTiposCambio(query: { desde?: string; hasta?: string; moneda?: string } = {}): Observable<TipoCambio[]> {
    return this.http.get<TipoCambio[]>(`${this.api}/tipo-cambio`, { params: toParams(query) });
  }
  getTipoCambioVigente(moneda: string, fecha?: string): Observable<TipoCambioVigente> {
    return this.http.get<TipoCambioVigente>(`${this.api}/tipo-cambio/vigente`, { params: toParams({ moneda, fecha }) });
  }
  saveTipoCambio(data: { fecha: string; moneda_id: string; compra: string; venta: string }): Observable<TipoCambio> {
    return this.http.post<TipoCambio>(`${this.api}/tipo-cambio`, data);
  }

  // ---- Programación
  getPendientes(query: object = {}): Observable<Paginated<DocumentoAdmin>> {
    return this.http.get<Paginated<DocumentoAdmin>>(`${this.api}/programacion/pendientes`, { params: toParams(query) });
  }
  getAgenda(query: { desde?: string; hasta?: string; estado?: string; concepto?: string; id_cuenta?: number } = {}): Observable<Agenda> {
    return this.http.get<Agenda>(`${this.api}/programacion`, { params: toParams(query) });
  }
  programar(items: ProgramacionItemPayload[], idProgramadoPor?: number): Observable<Programacion[]> {
    return this.http.post<Programacion[]>(`${this.api}/programacion`, { id_programado_por: idProgramadoPor, items });
  }
  reprogramar(id: number, data: Partial<ProgramacionItemPayload>): Observable<Programacion> {
    return this.http.patch<Programacion>(`${this.api}/programacion/${id}`, data);
  }
  cancelarProgramacion(id: number): Observable<Programacion> {
    return this.http.post<Programacion>(`${this.api}/programacion/${id}/cancelar`, {});
  }

  // ---- Pagos
  getPagos(query: PagoQuery = {}): Observable<Paginated<Pago>> {
    return this.http.get<Paginated<Pago>>(`${this.api}/pagos`, { params: toParams(query) });
  }
  getPago(id: number): Observable<Pago> {
    return this.http.get<Pago>(`${this.api}/pagos/${id}`);
  }
  ejecutar(data: EjecutarPagoPayload): Observable<Pago> {
    return this.http.post<Pago>(`${this.api}/pagos`, data);
  }
  pagarDirecto(data: PagoDirectoPayload): Observable<Pago> {
    return this.http.post<Pago>(`${this.api}/pagos/directo`, data);
  }
  anularPago(id: number, motivo?: string): Observable<Pago> {
    return this.http.post<Pago>(`${this.api}/pagos/${id}/anular`, { motivo });
  }

  // ---- Consulta
  getResumen(query: ResumenQuery = {}): Observable<Resumen> {
    return this.http.get<Resumen>(`${this.api}/consulta/resumen`, { params: toParams(query) });
  }
  getRetenciones(periodo: string): Observable<Retenciones> {
    return this.http.get<Retenciones>(`${this.api}/consulta/retenciones`, { params: toParams({ periodo }) });
  }
}
