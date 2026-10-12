import { Signal, WritableSignal, computed, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import type { Paginated } from '@shared/models';

export interface PaginatedQueryOptions<F, T> {
  /** Filtros de la consulta. Al cambiar, la página vuelve a 1 y se relanza la petición. */
  filters: Signal<F>;
  /** Tamaño de página inicial (por defecto 20). */
  pageSize?: number;
  load: (params: F & { page: number; pageSize: number }) => Observable<Paginated<T>>;
}

export interface PaginatedQuery<T> {
  /** Filas de la última respuesta válida (se conservan mientras carga o si falla la siguiente). */
  readonly items: Signal<readonly T[]>;
  readonly total: Signal<number>;
  readonly totalPages: Signal<number>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  /** Página actual, escribible. Vuelve a 1 cuando cambian los filtros o el tamaño de página. */
  readonly page: WritableSignal<number>;
  readonly pageSize: WritableSignal<number>;
  readonly hasPrev: Signal<boolean>;
  readonly hasNext: Signal<boolean>;
  /** Repite la última petición. No hace nada si ya hay una en curso. */
  reload(): void;
}

/**
 * Listado paginado y filtrado con cancelación, estado de carga y error, sin `subscribe` en el
 * componente. Debe llamarse en un contexto de inyección (campo o constructor de un componente).
 *
 * Una petición en curso se cancela si cambian los filtros o la página, así que una respuesta
 * tardía de una consulta anterior nunca sobrescribe la actual.
 *
 * @example
 * ```ts
 * filtros = signal({ search: '' });
 * ccs = createPaginatedQuery({
 *   filters: this.filtros,
 *   pageSize: 50,
 *   load: ({ page, pageSize, search }) => this.service.getAll(page, pageSize, { search }),
 * });
 * // template: @for (cc of ccs.items(); ...)   (click)="ccs.page.set(ccs.page() + 1)"
 * ```
 */
export function createPaginatedQuery<F, T>(options: PaginatedQueryOptions<F, T>): PaginatedQuery<T> {
  const pageSize = signal(options.pageSize ?? 20);
  const page = linkedSignal({
    source: () => ({ filters: options.filters(), pageSize: pageSize() }),
    computation: () => 1,
  });

  // Última respuesta válida (evita que la lista parpadee al cargar y la conserva si hay error) y
  // error original (el resource envuelve los que no son `Error`, como HttpErrorResponse). Se
  // escriben desde el stream: rxResource cancela los streams viejos, así que una respuesta
  // tardía nunca llega a escribirlos.
  const last = signal<Paginated<T> | undefined>(undefined);
  const lastError = signal<unknown>(undefined);

  const resource = rxResource({
    params: () => ({ ...options.filters(), page: page(), pageSize: pageSize() }),
    stream: ({ params }) =>
      options.load(params).pipe(
        tap({
          next: (respuesta) => {
            last.set(respuesta);
            lastError.set(undefined);
          },
          error: (error: unknown) => lastError.set(error),
        }),
      ),
  });

  const total = computed(() => last()?.total ?? 0);
  const totalPages = computed(() => last()?.totalPages ?? 0);

  return {
    items: computed(() => last()?.data ?? []),
    total,
    totalPages,
    isLoading: resource.isLoading,
    error: computed(() => (resource.status() === 'error' ? lastError() : undefined)),
    page,
    pageSize,
    hasPrev: computed(() => page() > 1),
    hasNext: computed(() => page() < totalPages()),
    reload: () => resource.reload(),
  };
}
