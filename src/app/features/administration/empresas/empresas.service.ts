import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Empresa, EmpresaApi } from './interfaces';
import { environment } from '@env';

/** Empresa de la API con los alias que usan las pantallas (PascalCase y snake_case, sin `null`). */
export function normalizarEmpresa(item: EmpresaApi): Empresa {
  const id = item.id_empresa;
  const ruc = item.ruc || '';
  const razonSocial = item.razon_social || '';
  const domicilioFiscal = item.domicilio_fiscal || '';
  const direccionEntrega = item.direccion_entrega || '';
  const correoCompras = item.correo_compras || '';
  return {
    id,
    id_empresa: id,
    CodEmpresa: id ? `EMP-${String(id).padStart(3, '0')}` : '—',
    RUC: ruc,
    ruc,
    RazonSocial: razonSocial,
    razon_social: razonSocial,
    DomicilioFiscal: domicilioFiscal,
    domicilio_fiscal: domicilioFiscal,
    DireccionEntrega: direccionEntrega,
    direccion_entrega: direccionEntrega,
    CorreoCompras: correoCompras,
    correo_compras: correoCompras,
  };
}

@Service()
export class EmpresasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/administration/empresas`;

  getAll(): Observable<Empresa[]> {
    return this.http.get<EmpresaApi[]>(this.apiUrl).pipe(map((list) => list.map(normalizarEmpresa)));
  }

  getById(id: number | string): Observable<Empresa> {
    return this.http.get<EmpresaApi>(`${this.apiUrl}/${id}`).pipe(map(normalizarEmpresa));
  }

  create(data: Empresa): Observable<Empresa> {
    const payload = this.toPayload(data);
    return this.http.post<Empresa>(this.apiUrl, payload);
  }

  update(id: number | string, data: Partial<Empresa>): Observable<Empresa> {
    const payload = this.toPayload(data);
    return this.http.patch<Empresa>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private toPayload(data: Partial<Empresa>) {
    return {
      ruc: data.ruc || data.RUC || undefined,
      razon_social: data.razon_social || data.RazonSocial || undefined,
      domicilio_fiscal: data.domicilio_fiscal || data.DomicilioFiscal || undefined,
      direccion_entrega: data.direccion_entrega || data.DireccionEntrega || undefined,
      correo_compras: data.correo_compras || data.CorreoCompras || undefined,
    };
  }
}
