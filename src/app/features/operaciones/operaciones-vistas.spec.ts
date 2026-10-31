import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { CargaEquipoComponent } from './carga-equipo/carga-equipo';
import { CronogramaComponent } from './cronograma/cronograma';
import { CulminadosComponent } from './culminados/culminados';
import { CurvaSComponent } from './curva-s/curva-s';
import { EnVivoComponent } from './en-vivo/en-vivo';
import { EquipoComponent } from './equipo/equipo';
import { IndicadoresComponent } from './indicadores/indicadores';
import { PartidasComponent } from './partidas/partidas';
import { PorClienteComponent } from './por-cliente/por-cliente';
import { PorDepartamentoComponent } from './por-departamento/por-departamento';
import { OperacionesShellComponent } from './shell/operaciones-shell';
import { TvComponent } from './tv/tv';
import { OperacionesStore } from './operaciones.store';
import { obraResumen, portafolio } from './operaciones.testing';

const obras = [
  obraResumen({ id: 1, estado: 'EN_EJECUCION', clave: 'crit', real: 30, programado: 50, tienda: 'Norte' }),
  obraResumen({ id: 2, estado: 'EN_EJECUCION', clave: 'good', cliente: [2, 'Cliente B'], jefe: [11, 'Dino Vera'], departamento: 'Cusco', tienda: 'Sur' }),
  obraResumen({ id: 3, estado: 'PROXIMO', inicio: '2026-11-02', tienda: 'Este' }),
  obraResumen({ id: 4, estado: 'POST_VENTA', inicio: '2026-03-01', fin: '2026-08-01', postVenta: { inicio: '2026-08-10', dias: 58 }, tienda: 'Oeste' }),
  obraResumen({ id: 5, estado: 'CULMINADO', inicio: '2025-05-01', fin: '2025-09-01', postVenta: { inicio: '2025-09-05', dias: 14 }, tienda: 'Viejo' }),
];

const ESTADO_AVISOS = { visto_hasta: null, tipos_importantes: null, no_leidos: 0 };

/** La campana pide su estado y el feed al crearse: se atienden antes de esperar. */
function atenderAvisos(http: HttpTestingController): void {
  http.expectOne((r) => r.url.endsWith('/operaciones/avisos')).flush(ESTADO_AVISOS);
  http.expectOne((r) => r.url.endsWith('/operaciones/portafolio/eventos')).flush([]);
}

/** `arboles`: respuesta de `GET …/arboles` para las vistas que lo piden (hay que atenderlo antes de esperar). */
async function montar<T>(componente: Type<T>, datos = obras, ruta: Record<string, unknown> = {}, arboles?: unknown[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: ruta } } }],
  });
  const fixture = TestBed.createComponent(componente);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne((r) => r.url.endsWith('/operaciones/portafolio')).flush(portafolio(datos));
  fixture.detectChanges();
  if (componente === (OperacionesShellComponent as Type<unknown>)) {
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    atenderAvisos(http);
  }
  let pedido: ReturnType<HttpTestingController['expectOne']> | null = null;
  if (arboles) {
    // Los recursos arrancan en el siguiente ciclo, cuando ya hay portafolio.
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    pedido = http.expectOne((r) => r.url.endsWith('/operaciones/portafolio/arboles'));
    pedido.flush(arboles);
  }
  await fixture.whenStable();
  fixture.detectChanges();
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, el: fixture.nativeElement as HTMLElement, http, render, pedido, store: TestBed.inject(OperacionesStore) };
}

const texto = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Dashboard de Operaciones · vistas', () => {
  it('en vivo: los KPI cuadran con la bitácora (vigentes = ejecución + próximos + post venta)', async () => {
    const { el } = await montar(EnVivoComponent);

    expect(texto(el, 'kpi-vigentes')).toContain('4');
    expect(texto(el, 'kpi-ejecucion')).toContain('2');
    expect(texto(el, 'kpi-proximos')).toContain('1');
    expect(texto(el, 'kpi-postventa')).toContain('1');
    expect(el.querySelectorAll('[data-testid="bitacora"] tbody tr')).toHaveLength(4); // la culminada no aparece
  });

  it('en vivo: un clic en una obra deja solo esa obra en el store (filtro global)', async () => {
    const { el, render, store } = await montar(EnVivoComponent);
    el.querySelector<HTMLButtonElement>('[data-testid="bitacora"] tbody .ops-tabla__link')?.click();
    await render();

    expect(store.filtros().q).toBe('OP-26-001');
    expect(store.obras()).toHaveLength(1);
    expect(el.querySelectorAll('[data-testid="bitacora"] tbody tr')).toHaveLength(1);
  });

  it('en vivo sin obras vigentes lo dice', async () => {
    const { el } = await montar(EnVivoComponent, [obras[4]]);

    expect(el.querySelector('[data-testid="sin-obras"]')).not.toBeNull();
  });

  it('indicadores: requieren atención lista la retrasada y la post venta muestra los días', async () => {
    const { el } = await montar(IndicadoresComponent);

    expect(el.querySelectorAll('[data-testid="tabla-atencion"] tbody tr')).toHaveLength(1);
    expect(texto(el, 'tabla-atencion')).toContain('Retrasada');
    expect(texto(el, 'ind-postventa')).toContain('58');
    expect(el.querySelectorAll('[data-testid="grafico-meses"] > div')).toHaveLength(12);
  });

  it('por cliente: una tarjeta por cliente y el filtro al hacer clic', async () => {
    const { el, render, store } = await montar(PorClienteComponent);
    expect(el.querySelectorAll('[data-testid="tarjeta-cliente"]')).toHaveLength(2);

    el.querySelectorAll<HTMLButtonElement>('[data-testid="tarjeta-cliente"] button')[1].click();
    await render();
    expect(store.filtros().cliente).not.toBeNull();
  });

  it('por departamento: ranking con las obras vigentes', async () => {
    const { el } = await montar(PorDepartamentoComponent);

    expect(texto(el, 'ranking-departamentos')).toContain('Lima');
    expect(texto(el, 'ranking-departamentos')).toContain('Cusco');
  });

  it('culminados: % a tiempo y desfase', async () => {
    const { el } = await montar(CulminadosComponent);

    expect(texto(el, 'kpi-a-tiempo')).toContain('0%'); // entregada 4 días tarde
    expect(texto(el, 'tabla-culminadas')).toContain('+4 d');
  });

  it('equipo: una fila por obra vigente con su gente', async () => {
    const { el } = await montar(EquipoComponent);

    expect(el.querySelectorAll('[data-testid="tabla-equipo"] tbody tr')).toHaveLength(4);
    expect(texto(el, 'tabla-equipo')).toContain('Ana Ruiz');
  });

  it('jefes: carga contra la referencia 10; coordinadores: contra 5', async () => {
    const jefes = await montar(CargaEquipoComponent, obras, { rol: 'jefe' });
    expect(texto(jefes.el, 'lista-carga')).toContain('/ 10');
    expect(texto(jefes.el, 'resumen-carga')).toContain('en sobrecarga');

    const coordinadores = await montar(CargaEquipoComponent, obras, { rol: 'coordinador' });
    expect(texto(coordinadores.el, 'lista-carga')).toContain('/ 5');
  });

  it('partidas pide los árboles solo de las obras en ejecución y post venta', async () => {
    const arbol = [
      { id_centro_costo: 1, curvaS: null, partidas: [{ item: '01', nombre: 'Preliminares', tipo: 'CONTRACTUAL', inicio: '2026-09-14', fin: '2026-09-30', peso: 100, real: 30, programado: 50, programadoFinSemana: 50, desviacion: -20, situacion: { clave: 'crit', texto: 'Retrasada' }, subpartidas: [] }] },
    ];
    const { pedido, el, render } = await montar(PartidasComponent, obras, {}, arbol);
    expect(pedido?.request.params.get('ids')).toBe('1,2,4');

    expect(el.querySelectorAll('[data-testid="arbol-partidas"] tbody tr')).toHaveLength(3); // 3 obras, plegadas
    el.querySelector<HTMLButtonElement>('[data-testid="arbol-partidas"] .ops-arbol__alternar')?.click();
    await render();
    expect(texto(el, 'arbol-partidas')).toContain('01 Preliminares');
  });

  it('curva S muestra la tabla de obras en ejecución con su mini curva', async () => {
    const { el } = await montar(CurvaSComponent, obras, {}, []);

    expect(el.querySelectorAll('[data-testid="tabla-curvas"] tbody tr')).toHaveLength(2);
    expect(el.querySelectorAll('[data-testid="tabla-curvas"] app-ops-curva-mini svg')).toHaveLength(2);
  });

  it('cronograma dibuja una barra por obra', async () => {
    const { el } = await montar(CronogramaComponent, obras, {}, []);

    expect(el.querySelectorAll('.ops-gantt__barra')).toHaveLength(3);
  });
});

describe('Dashboard de Operaciones · marco y filtros globales', () => {
  it('los filtros acotan las obras y se pueden quitar con su chip o con «Limpiar filtros»', async () => {
    const { el, render, store } = await montar(OperacionesShellComponent);
    expect(texto(el, 'resumen-filtro')).toContain('5 de 5');

    store.actualizar({ cliente: 2 });
    await render();
    expect(texto(el, 'resumen-filtro')).toContain('1 de 5');
    expect(texto(el, 'chips-filtro')).toContain('Cliente: Cliente B');

    el.querySelector<HTMLButtonElement>('[data-testid="chips-filtro"] button')?.click();
    await render();
    expect(store.filtrado()).toBe(false);
    expect(texto(el, 'resumen-filtro')).toContain('5 de 5');
  });

  it('avisa las obras que no se pueden calcular por falta de fechas', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(OperacionesShellComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/operaciones/portafolio')).flush({ ...portafolio(obras), sin_evaluar: [{ id_centro_costo: 99, codigo_obra: null, centro_costo: 'X', faltantes: ['fecha_inicio'] }] });
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    atenderAvisos(http);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture.nativeElement, 'sin-evaluar')).toContain('1 obra(s)');
  });

  it('muestra un error si el portafolio no carga', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(OperacionesShellComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/operaciones/portafolio')).flush('fallo', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    atenderAvisos(http);
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
  });
});

describe('Modo pantalla (TV)', () => {
  const muchas = Array.from({ length: 10 }, (_v, i) => obraResumen({ id: 50 + i, tienda: `T${i}` }));

  it('muestra 8 obras por página y programa el cambio de página cada 3 minutos', async () => {
    const intervalos = vi.spyOn(globalThis, 'setInterval');
    const { el, render } = await montar(TvComponent, muchas);
    expect(el.querySelectorAll('[data-testid="tv-tabla"] tbody tr')).toHaveLength(8);
    expect(el.textContent).toContain('página 1 de 2');

    const paso = intervalos.mock.calls.find((c) => c[1] === 180_000);
    expect(paso).toBeDefined();
    (paso?.[0] as () => void)();
    await render();
    expect(el.querySelectorAll('[data-testid="tv-tabla"] tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('página 2 de 2');

    (paso?.[0] as () => void)();
    await render();
    expect(el.textContent).toContain('página 1 de 2'); // da la vuelta
    expect(intervalos.mock.calls.some((c) => c[1] === 300_000)).toBe(true); // relectura cada 5 min
    intervalos.mockRestore();
  });

  it('← y → navegan y Esc sale al dashboard', async () => {
    const { el, render, fixture } = await montar(TvComponent, muchas);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await render();
    expect(el.textContent).toContain('página 2 de 2');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await render();
    expect(el.textContent).toContain('página 1 de 2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(navegar).toHaveBeenCalledWith(['/operaciones/en-vivo']);
    fixture.destroy();
  });

  it('la cinta lista los clientes de las obras vigentes', async () => {
    const { el } = await montar(TvComponent);

    expect(texto(el, 'tv-clientes')).toContain('Cliente A');
    expect(texto(el, 'tv-clientes')).toContain('Cliente B');
  });
});
