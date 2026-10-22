import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';

export interface EmpresaCabecera {
  razon_social?: string | null;
  ruc?: string | null;
  domicilio_fiscal?: string | null;
}

@Service()
export class ImprimirService {
  private http = inject(HttpClient);

  /** Empresas registradas; el formato impreso usa la primera como cabecera. */
  getEmpresas(): Observable<EmpresaCabecera[]> {
    return this.http.get<EmpresaCabecera[]>(`${environment.apiUrl}/administration/empresas`);
  }
}
