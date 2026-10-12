import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import type { Paginated } from '@shared/models';
import { createPaginatedQuery } from './create-paginated-query';

interface Filtros { search: string }
type Params = Filtros & { page: number; pageSize: number };

function pagina(data: string[], page = 1, total = data.length, totalPages = 1): Paginated<string> {
  return { data, page, pageSize: 20, total, totalPages };
}

/** Deja que el resource procese la respuesta (llega en una microtarea) y ejecuta los efectos. */
async function flush() {
  await new Promise((r) => setTimeout(r));
  TestBed.tick();
}

/** Cada llamada a `load` devuelve un Subject propio para controlar cuándo y cómo responde. */
async function crearQuery(pageSize?: number) {
  const llamadas: { params: Params; respuesta: Subject<Paginated<string>> }[] = [];
  const filtros = signal<Filtros>({ search: '' });
  const query = TestBed.runInInjectionContext(() =>
    createPaginatedQuery<Filtros, string>({
      filters: filtros,
      pageSize,
      load: (params): Observable<Paginated<string>> => {
        const respuesta = new Subject<Paginated<string>>();
        llamadas.push({ params, respuesta });
        return respuesta;
      },
    }),
  );
  await flush();
  return { query, filtros, llamadas, ultima: () => llamadas[llamadas.length - 1] };
}

describe('createPaginatedQuery', () => {
  it('carga la primera página con los filtros y el tamaño de página', async () => {
    // Arrange / Act
    const { query, ultima } = await crearQuery(50);

    // Assert
    expect(ultima().params).toEqual({ search: '', page: 1, pageSize: 50 });
    expect(query.isLoading()).toBe(true);

    ultima().respuesta.next(pagina(['a', 'b'], 1, 120, 3));
    await flush();
    expect(query.items()).toEqual(['a', 'b']);
    expect(query.total()).toBe(120);
    expect(query.totalPages()).toBe(3);
    expect(query.isLoading()).toBe(false);
    expect(query.hasPrev()).toBe(false);
    expect(query.hasNext()).toBe(true);
  });

  it('cambiar la página relanza la petición con la página nueva', async () => {
    const { query, ultima } = await crearQuery();
    ultima().respuesta.next(pagina(['a'], 1, 60, 3));
    await flush();

    query.page.set(2);
    await flush();

    expect(ultima().params.page).toBe(2);
    expect(query.items()).toEqual(['a']); // conserva la anterior mientras carga
    ultima().respuesta.next(pagina(['b'], 2, 60, 3));
    await flush();
    expect(query.items()).toEqual(['b']);
    expect(query.hasPrev()).toBe(true);
  });

  it('cambiar los filtros vuelve a la página 1 y relanza la petición', async () => {
    const { query, filtros, ultima } = await crearQuery();
    ultima().respuesta.next(pagina(['a'], 1, 60, 3));
    await flush();
    query.page.set(3);
    await flush();

    filtros.set({ search: 'obra' });
    await flush();

    expect(query.page()).toBe(1);
    expect(ultima().params).toEqual({ search: 'obra', page: 1, pageSize: 20 });
  });

  it('cambiar el tamaño de página vuelve a la página 1', async () => {
    const { query, ultima } = await crearQuery();
    query.page.set(2);
    await flush();

    query.pageSize.set(100);
    await flush();

    expect(query.page()).toBe(1);
    expect(ultima().params).toMatchObject({ page: 1, pageSize: 100 });
  });

  it('una respuesta tardía de una petición anterior no sobrescribe la actual', async () => {
    const { query, filtros, llamadas } = await crearQuery();
    filtros.set({ search: 'nuevo' });
    await flush();
    const [vieja, nueva] = llamadas;

    nueva.respuesta.next(pagina(['actual']));
    await flush();
    vieja.respuesta.next(pagina(['tardía']));
    await flush();

    expect(vieja.respuesta.observed).toBe(false);
    expect(query.items()).toEqual(['actual']);
  });

  it('reload() repite la última petición', async () => {
    const { query, filtros, llamadas } = await crearQuery();
    filtros.set({ search: 'x' });
    await flush();
    query.page.set(2);
    await flush();
    llamadas[llamadas.length - 1].respuesta.next(pagina(['p2'], 2, 40, 2));
    await flush();
    const antes = llamadas.length;

    query.reload();
    await flush();

    expect(llamadas.length).toBe(antes + 1);
    expect(llamadas[llamadas.length - 1].params).toEqual({ search: 'x', page: 2, pageSize: 20 });
  });

  it('el error queda en error() e items() conserva el último valor válido', async () => {
    const { query, filtros, ultima } = await crearQuery();
    ultima().respuesta.next(pagina(['válido']));
    await flush();

    filtros.set({ search: 'falla' });
    await flush();
    ultima().respuesta.error({ status: 500 });
    await flush();

    expect(query.error()).toEqual({ status: 500 });
    expect(query.items()).toEqual(['válido']);
    expect(query.isLoading()).toBe(false);
  });
});
