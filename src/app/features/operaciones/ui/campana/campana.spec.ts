import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { EnVivoComponent } from '../../en-vivo/en-vivo';
import { EventoPortafolio } from '../../operaciones.interface';
import { OperacionesStore } from '../../operaciones.store';
import { obraResumen, portafolio } from '../../operaciones.testing';
import { CampanaComponent } from './campana';

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const evento = (id: number, extra: Partial<EventoPortafolio> = {}): EventoPortafolio => ({
  id,
  id_centro_costo: 1,
  codigo_obra: 'OP-26-001',
  centro_costo: 'Cliente Norte',
  tipo: 'SITUACION',
  titulo: 'Pasó a Retrasada',
  detalle: null,
  valor_antes: null,
  valor_despues: null,
  severidad: 'crit',
  usuario: null,
  created_at: hace(5),
  ...extra,
});

async function montar(eventos: EventoPortafolio[], estado = { visto_hasta: null as string | null, tipos_importantes: null as string[] | null, no_leidos: 0 }) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const fixture = TestBed.createComponent(CampanaComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  // El store (compartido) también lee el portafolio al crearse.
  http.expectOne((r) => r.url.endsWith('/operaciones/portafolio')).flush(portafolio([]));
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
  http.expectOne((r) => r.url.endsWith('/operaciones/avisos')).flush(estado);
  http.expectOne((r) => r.url.endsWith('/operaciones/portafolio/eventos')).flush(eventos);
  await fixture.whenStable();
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const abrir = async () => {
    el.querySelector<HTMLButtonElement>('[data-testid="campana"]')?.click();
    await render();
  };
  return { fixture, el, http, render, abrir, store: TestBed.inject(OperacionesStore) };
}

describe('CampanaComponent (RF-OP-48, 49)', () => {
  it('muestra cuántos avisos faltan por leer y los lista al abrir', async () => {
    const { el, abrir } = await montar([evento(2), evento(1, { titulo: 'Plazo vencido', tipo: 'VENCIDO', created_at: hace(60) })]);

    expect(el.querySelector('[data-testid="campana-contador"]')?.textContent?.trim()).toBe('2');
    await abrir();
    expect(el.querySelectorAll('[data-testid="campana-lista"] li')).toHaveLength(2);
    expect(el.textContent).toContain('Pasó a Retrasada');
    expect(el.textContent).toContain('hace 5 min');
  });

  it('lo anterior a la marca de lectura ya no cuenta', async () => {
    const { el } = await montar([evento(2), evento(1, { created_at: hace(120) })], { visto_hasta: hace(30), tipos_importantes: null, no_leidos: 1 });

    expect(el.querySelector('[data-testid="campana-contador"]')?.textContent?.trim()).toBe('1');
  });

  it('sin avisos lo dice y no muestra contador', async () => {
    const { el, abrir } = await montar([]);

    expect(el.querySelector('[data-testid="campana-contador"]')).toBeNull();
    await abrir();
    expect(el.querySelector('[data-testid="campana-vacia"]')).not.toBeNull();
  });

  it('«Marcar leídos» llama al servidor y el contador queda en cero', async () => {
    const { el, http, render, abrir } = await montar([evento(2)]);
    await abrir();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Marcar leídos'))?.click();

    const req = http.expectOne((r) => r.url.endsWith('/operaciones/avisos/leidos'));
    expect(req.request.method).toBe('POST');
    req.flush({ visto_hasta: new Date().toISOString(), tipos_importantes: null, no_leidos: 0 });
    await render();
    expect(el.querySelector('[data-testid="campana-contador"]')).toBeNull();
  });

  it('preferencias: desmarcar un tipo guarda los demás y oculta esos avisos', async () => {
    const { el, http, render, abrir } = await montar([evento(2), evento(1, { tipo: 'AVANCE', titulo: 'Avance semanal' })]);
    await abrir();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Preferencias'))?.click();
    await render();

    const casillas = Array.from(el.querySelectorAll<HTMLInputElement>('[data-testid="campana-preferencias"] input'));
    expect(casillas.every((c) => c.checked)).toBe(true);
    const avance = casillas[2]; // ALTA, ESTADO, AVANCE…
    avance.checked = false;
    avance.dispatchEvent(new Event('change'));

    const req = http.expectOne((r) => r.url.endsWith('/operaciones/avisos/preferencias'));
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as { tipos_importantes: string[] }).tipos_importantes).not.toContain('AVANCE');
    expect((req.request.body as { tipos_importantes: string[] }).tipos_importantes).toContain('SITUACION');
    req.flush({ visto_hasta: null, tipos_importantes: ['ALTA', 'ESTADO', 'PLAZO', 'EQUIPO', 'REPROGRAMACION', 'SITUACION', 'VENCIDO', 'SOBRECARGA'], no_leidos: 1 });
    await render();
    expect(el.textContent).not.toContain('Avance semanal');
  });

  it('un clic en un aviso abre la obra en el cockpit', async () => {
    const { el, abrir } = await montar([evento(2, { id_centro_costo: 77 })]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await abrir();
    el.querySelector<HTMLButtonElement>('[data-testid="campana-lista"] button')?.click();

    expect(navegar).toHaveBeenCalledWith(['/centros-costos', 77, 'datos']);
  });
});

describe('«⚠ N avisos» por obra (En vivo)', () => {
  it('marca la obra con avisos sin leer de severidad advertencia o crítica', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(EnVivoComponent);
    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(OperacionesStore);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/operaciones/portafolio')).flush(portafolio([obraResumen({ id: 1 }), obraResumen({ id: 2 })]));
    store.pedirAvisos();
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/operaciones/avisos')).flush({ visto_hasta: null, tipos_importantes: null, no_leidos: 0 });
    http.expectOne((r) => r.url.endsWith('/operaciones/portafolio/eventos')).flush([evento(1), evento(2, { severidad: 'info' }), evento(3, { id_centro_costo: 2, severidad: 'good' })]);
    await fixture.whenStable();
    fixture.detectChanges();

    const marcas = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="avisos-obra"]');
    expect(marcas).toHaveLength(1);
    expect(marcas[0].textContent).toContain('1 aviso');
  });
});
