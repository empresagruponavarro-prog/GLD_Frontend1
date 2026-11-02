import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';

/** Catálogos que mantiene RR.HH. (segmento de la URL de la API). */
export type Catalogo = 'tipos-trabajador' | 'modalidades-contrato';

export interface OpcionRrhh {
  id: number;
  nombre: string;
  activo: boolean;
  orden: number;
  /** Trabajadores que la tienen; si es mayor que 0 no se puede eliminar. */
  usos: number;
}

/** Acceso HTTP a RR.HH. › Catálogos de RR.HH. (`/rrhh/catalogos`). */
@Service()
export class CatalogosRrhhService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/rrhh/catalogos`;

  listar(catalogo: Catalogo): Observable<OpcionRrhh[]> {
    return this.http.get<OpcionRrhh[]>(`${this.api}/${catalogo}`);
  }

  crear(catalogo: Catalogo, nombre: string): Observable<OpcionRrhh> {
    return this.http.post<OpcionRrhh>(`${this.api}/${catalogo}`, { nombre });
  }

  actualizar(catalogo: Catalogo, id: number, cambios: { nombre?: string; activo?: boolean }): Observable<OpcionRrhh> {
    return this.http.patch<OpcionRrhh>(`${this.api}/${catalogo}/${id}`, cambios);
  }

  /** Devuelve la lista ya reordenada. */
  mover(catalogo: Catalogo, id: number, direccion: 'arriba' | 'abajo'): Observable<OpcionRrhh[]> {
    return this.http.post<OpcionRrhh[]>(`${this.api}/${catalogo}/${id}/mover`, { direccion });
  }

  eliminar(catalogo: Catalogo, id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${catalogo}/${id}`);
  }
}
