import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Empresa } from './interfaces';
import { environment } from '@env';

@Service()
export class EmpresasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/administration/empresas`;

  getAll(): Observable<Empresa[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map((list) =>
        list.map((item) => {
          const id = item.id_empresa ?? item.id;
          return {
            ...item,
            id,
            id_empresa: id,
            CodEmpresa: item.CodEmpresa || (id ? `EMP-${String(id).padStart(3, '0')}` : '—'),
            RUC: item.RUC || item.ruc || '',
            ruc: item.ruc || item.RUC || '',
            RazonSocial: item.RazonSocial || item.razon_social || '',
            razon_social: item.razon_social || item.RazonSocial || '',
            DomicilioFiscal: item.DomicilioFiscal || item.domicilio_fiscal || '',
            domicilio_fiscal: item.domicilio_fiscal || item.DomicilioFiscal || '',
            DireccionEntrega: item.DireccionEntrega || item.direccion_entrega || '',
            direccion_entrega: item.direccion_entrega || item.DireccionEntrega || '',
            CorreoCompras: item.CorreoCompras || item.correo_compras || '',
            correo_compras: item.correo_compras || item.CorreoCompras || '',
          };
        })
      )
    );
  }

  getById(id: number | string): Observable<Empresa> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map((item) => {
        const itemId = item.id_empresa ?? item.id;
        return {
          ...item,
          id: itemId,
          id_empresa: itemId,
          CodEmpresa: item.CodEmpresa || (itemId ? `EMP-${String(itemId).padStart(3, '0')}` : '—'),
          RUC: item.RUC || item.ruc || '',
          ruc: item.ruc || item.RUC || '',
          RazonSocial: item.RazonSocial || item.razon_social || '',
          razon_social: item.razon_social || item.RazonSocial || '',
          DomicilioFiscal: item.DomicilioFiscal || item.domicilio_fiscal || '',
          domicilio_fiscal: item.domicilio_fiscal || item.DomicilioFiscal || '',
          DireccionEntrega: item.DireccionEntrega || item.direccion_entrega || '',
          direccion_entrega: item.direccion_entrega || item.DireccionEntrega || '',
          CorreoCompras: item.CorreoCompras || item.correo_compras || '',
          correo_compras: item.correo_compras || item.CorreoCompras || '',
        };
      })
    );
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
