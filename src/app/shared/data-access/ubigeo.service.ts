import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';

/** Opción de un catálogo ubigeo INEI: código (2, 4 o 6 dígitos) y nombre. */
export interface OpcionUbigeo {
  id: string;
  nombre: string;
  /** Solo en distritos: centro del distrito. */
  latitud?: number;
  longitud?: number;
}

/** Ubicación completa de un distrito. */
export interface Ubicacion {
  id_distrito: string;
  id_provincia: string;
  id_departamento: string;
  departamento: string;
  provincia: string;
  distrito: string;
  latitud?: number;
  longitud?: number;
}

/**
 * Catálogo ubigeo INEI (`/maestros/ubigeo`). El código es jerárquico: los 2 primeros dígitos son el departamento,
 * los 4 primeros la provincia y los 6 el distrito (15 › 1501 › 150142).
 */
@Service()
export class UbigeoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/maestros/ubigeo`;

  departamentos(): Observable<OpcionUbigeo[]> {
    return this.http.get<OpcionUbigeo[]>(`${this.api}/departamentos`);
  }

  provincias(idDepartamento: string): Observable<OpcionUbigeo[]> {
    return this.http.get<OpcionUbigeo[]>(`${this.api}/provincias`, { params: new HttpParams().set('departamento', idDepartamento) });
  }

  distritos(idProvincia: string): Observable<OpcionUbigeo[]> {
    return this.http.get<OpcionUbigeo[]>(`${this.api}/distritos`, { params: new HttpParams().set('provincia', idProvincia) });
  }

  ubicacion(idDistrito: string): Observable<Ubicacion> {
    return this.http.get<Ubicacion>(`${this.api}/distritos/${idDistrito}`);
  }
}
