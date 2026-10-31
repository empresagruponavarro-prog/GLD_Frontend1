import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { ArbolObra, EstadoAvisos, EventoPortafolio, Portafolio } from './operaciones.interface';

/** Dashboard de Operaciones: vistas con todas las obras (`operaciones/portafolio`). */
@Service()
export class OperacionesService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiUrl}/operaciones/portafolio`;

  /** Todas las obras evaluables; los filtros globales se aplican en el cliente (ver el store). */
  getPortafolio(): Observable<Portafolio> {
    return this.#http.get<Portafolio>(this.#base);
  }

  getArboles(ids: readonly number[]): Observable<ArbolObra[]> {
    return this.#http.get<ArbolObra[]>(`${this.#base}/arboles`, { params: { ids: ids.join(',') } });
  }

  getEstadoAvisos(): Observable<EstadoAvisos> {
    return this.#http.get<EstadoAvisos>(`${environment.apiUrl}/operaciones/avisos`);
  }

  marcarLeidos(): Observable<EstadoAvisos> {
    return this.#http.post<EstadoAvisos>(`${environment.apiUrl}/operaciones/avisos/leidos`, {});
  }

  /** `null` o lista vacía = todos los tipos. */
  guardarPreferencias(tipos: readonly string[] | null): Observable<EstadoAvisos> {
    return this.#http.put<EstadoAvisos>(`${environment.apiUrl}/operaciones/avisos/preferencias`, { tipos_importantes: tipos?.length ? tipos : null });
  }

  getEventos(limite = 100, tipos?: readonly string[]): Observable<EventoPortafolio[]> {
    return this.#http.get<EventoPortafolio[]>(`${this.#base}/eventos`, {
      params: { limite, ...(tipos?.length ? { tipos: tipos.join(',') } : {}) },
    });
  }
}
