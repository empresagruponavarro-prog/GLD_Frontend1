import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ValidacionPresupuesto } from '../presupuestos.service';
import { AprobacionPanelComponent } from './aprobacion-panel';

const validacion = (sobre: Partial<ValidacionPresupuesto> = {}): ValidacionPresupuesto => ({
  id: 7,
  id_presupuesto: 'PPTO-2026-007',
  estado_ppto: 'EN_REVISION',
  tipo: 'Principal',
  puede_aprobar: true,
  problemas: [],
  bloqueos: [],
  resumen: { fases: 2, categorias: 3, items: 5, costo_directo: '4224.00' },
  ...sobre,
});

interface Montado {
  el: HTMLElement;
  http: HttpTestingController;
  render: () => Promise<void>;
  /** Solo detecta cambios (ejecuta los efectos que piden de nuevo la validación) sin esperar a que terminen las peticiones. */
  detectar: () => void;
  eventos: { aprobado: unknown[]; limpiado: unknown[]; versionCreada: unknown[] };
}

/** El panel pide la validación al abrirse con `rxResource`: se responde antes de esperar (`whenStable` no termina si no). */
async function montar(inputs: Record<string, unknown>, v: ValidacionPresupuesto = validacion()): Promise<Montado> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [AprobacionPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(AprobacionPanelComponent);
  fixture.componentRef.setInput('idPresupuesto', 'PPTO-2026-007');
  for (const [k, val] of Object.entries(inputs)) fixture.componentRef.setInput(k, val);
  const eventos = { aprobado: [] as unknown[], limpiado: [] as unknown[], versionCreada: [] as unknown[] };
  fixture.componentInstance.aprobado.subscribe((e) => eventos.aprobado.push(e));
  fixture.componentInstance.limpiado.subscribe((e) => eventos.limpiado.push(e));
  fixture.componentInstance.versionCreada.subscribe((e) => eventos.versionCreada.push(e));
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne((r) => r.url.endsWith('/presupuestos/PPTO-2026-007/validacion')).flush(v);
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await render();
  return { el: fixture.nativeElement as HTMLElement, http, render, detectar: () => fixture.detectChanges(), eventos };
}

const boton = (el: HTMLElement, texto: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement | undefined;
const clic = async (m: Montado, texto: string) => {
  boton(m.el, texto)?.click();
  await m.render();
};

describe('AprobacionPanelComponent', () => {
  it('un presupuesto completo muestra el resumen y deja aprobar', async () => {
    const m = await montar({ puedeAprobar: true });
    expect(m.el.textContent).toContain('2 fase(s) · 3 categoría(s) · 5 ítem(s)');
    expect(m.el.textContent).toContain('S/ 4224.00');
    expect(m.el.textContent).toContain('listo para aprobar');
    expect(boton(m.el, 'Aprobar presupuesto')?.disabled).toBe(false);
  });

  it('con pendientes lista lo que falta, deshabilita Aprobar y ofrece Limpiar vacíos a quien puede editar', async () => {
    const m = await montar(
      { puedeAprobar: true, puedeEditar: true },
      validacion({
        puede_aprobar: false,
        problemas: [
          { codigo: 'CATEGORIA_SIN_ITEMS', mensaje: 'La categoría «FACHADA» de la fase «ARUMA» no tiene ítems' },
          { codigo: 'FASE_SIN_CATEGORIAS', mensaje: 'La fase «MUROS» tiene un monto escrito a mano (S/ 200.00)' },
        ],
      }),
    );
    expect(m.el.textContent).toContain('Falta completar (2)');
    expect(m.el.textContent).toContain('«FACHADA»');
    expect(boton(m.el, 'Aprobar presupuesto')?.disabled).toBe(true);
    expect(boton(m.el, 'Limpiar vacíos')).toBeTruthy();
  });

  it('muchos pendientes se resumen con «y N más»', async () => {
    const problemas = Array.from({ length: 9 }, (_, i) => ({ codigo: 'ITEM_VACIO' as const, mensaje: `Ítem vacío ${i + 1}` }));
    const m = await montar({ puedeEditar: true }, validacion({ puede_aprobar: false, problemas }));
    expect(m.el.textContent).toContain('Falta completar (9)');
    expect(m.el.textContent).toContain('y 3 más');
    expect(m.el.textContent).not.toContain('Ítem vacío 9');
  });

  it('sin permiso «aprobar» no hay botón de aprobar y se explica por qué', async () => {
    const m = await montar({ puedeAprobar: false, puedeEditar: true });
    expect(boton(m.el, 'Aprobar presupuesto')).toBeUndefined();
    expect(m.el.textContent).toContain('permiso «aprobar»');
  });

  it('sin permiso «editar» no se ofrece Limpiar vacíos', async () => {
    const m = await montar(
      { puedeAprobar: true, puedeEditar: false },
      validacion({ puede_aprobar: false, problemas: [{ codigo: 'ITEM_VACIO', mensaje: 'x' }] }),
    );
    expect(boton(m.el, 'Limpiar vacíos')).toBeUndefined();
  });

  it('muestra los bloqueos de negocio (otro Principal aprobado)', async () => {
    const m = await montar(
      { puedeAprobar: true },
      validacion({ puede_aprobar: false, bloqueos: [{ codigo: 'OTRO_PRINCIPAL', mensaje: 'El centro de costo ya tiene un presupuesto Principal aprobado (PPTO-2026-001): cree este como adicional' }] }),
    );
    expect(m.el.textContent).toContain('cree este como adicional');
    expect(boton(m.el, 'Aprobar presupuesto')?.disabled).toBe(true);
  });

  it('aprobar pide confirmación y, al confirmar, aprueba, avisa y muestra la estructura creada', async () => {
    const m = await montar({ puedeAprobar: true });
    await clic(m, 'Aprobar presupuesto');
    expect(boton(m.el, 'Confirmar aprobación')).toBeTruthy();
    m.http.expectNone((r) => r.url.endsWith('/aprobar'));

    boton(m.el, 'Confirmar aprobación')?.click();
    const req = m.http.expectOne((r) => r.url.endsWith('/presupuestos/PPTO-2026-007/aprobar'));
    expect(req.request.method).toBe('POST');
    req.flush({ id: 7, id_presupuesto: 'PPTO-2026-007', estado_ppto: 'APROBADO', tipo: 'Principal', estructura: { capturada: true, partidas: 2, subpartidas: 3 } });
    // Tras aprobar vuelve a pedir la validación.
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion({ estado_ppto: 'APROBADO', puede_aprobar: false, bloqueos: [{ codigo: 'YA_APROBADO', mensaje: 'ya' }] }));
    await m.render();

    expect(m.eventos.aprobado).toHaveLength(1);
    expect(m.el.textContent).toContain('Presupuesto aprobado.');
    expect(m.el.textContent).toContain('2 partida(s) y 3 subpartida(s)');
    expect(m.el.textContent).toContain('ya está aprobado');
    expect(boton(m.el, 'Aprobar presupuesto')).toBeUndefined();
  });

  it('si no se pudo crear la estructura de la obra, dice por qué', async () => {
    const m = await montar({ puedeAprobar: true });
    await clic(m, 'Aprobar presupuesto');
    boton(m.el, 'Confirmar aprobación')?.click();
    m.http
      .expectOne((r) => r.url.endsWith('/aprobar'))
      .flush({ id: 7, id_presupuesto: 'PPTO-2026-007', estado_ppto: 'APROBADO', tipo: 'Principal', estructura: { capturada: false, partidas: 0, subpartidas: 0, motivo: 'El centro de costo no tiene inicio y fin programado' } });
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion({ estado_ppto: 'APROBADO' }));
    await m.render();
    expect(m.el.textContent).toContain('No se creó la estructura de la obra: El centro de costo no tiene inicio y fin programado');
  });

  it('un error al aprobar se muestra y se vuelve a verificar', async () => {
    const m = await montar({ puedeAprobar: true });
    await clic(m, 'Aprobar presupuesto');
    boton(m.el, 'Confirmar aprobación')?.click();
    m.http.expectOne((r) => r.url.endsWith('/aprobar')).flush({ message: 'El presupuesto no está completo (1 pendiente(s))' }, { status: 400, statusText: 'Bad Request' });
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion());
    await m.render();
    expect(m.el.querySelector('[role="alert"]')?.textContent).toContain('no está completo');
    expect(m.eventos.aprobado).toHaveLength(0);
  });

  it('cancelar la confirmación no ejecuta nada', async () => {
    const m = await montar({ puedeAprobar: true });
    await clic(m, 'Aprobar presupuesto');
    await clic(m, 'Cancelar');
    expect(boton(m.el, 'Aprobar presupuesto')).toBeTruthy();
    m.http.expectNone((r) => r.url.endsWith('/aprobar'));
  });

  it('limpiar vacíos pide confirmación, limpia, avisa y muestra el resultado', async () => {
    const m = await montar({ puedeEditar: true }, validacion({ puede_aprobar: false, problemas: [{ codigo: 'CATEGORIA_SIN_ITEMS', mensaje: 'cat sin ítems' }] }));
    await clic(m, 'Limpiar vacíos');
    boton(m.el, 'Confirmar: borrar vacíos')?.click();
    m.http
      .expectOne((r) => r.url.endsWith('/limpiar-vacios'))
      .flush({ items_eliminados: 1, categorias_eliminadas: 2, fases_sin_categorias: [{ id: 3, nombre: 'MUROS' }], costo_directo: '450.00' });
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion({ puede_aprobar: false }));
    await m.render();
    expect(m.eventos.limpiado).toHaveLength(1);
    expect(m.el.textContent).toContain('Se eliminaron 1 ítem(s) en cero y 2 categoría(s) sin ítems');
    expect(m.el.textContent).toContain('MUROS');
  });

  it('un Principal aprobado ofrece Nueva versión a quien puede crear; un adicional no', async () => {
    const principal = await montar({ puedeCrear: true }, validacion({ estado_ppto: 'APROBADO', puede_aprobar: false, bloqueos: [{ codigo: 'YA_APROBADO', mensaje: 'ya' }] }));
    expect(boton(principal.el, 'Nueva versión')).toBeTruthy();
    expect(boton(principal.el, 'Aprobar presupuesto')).toBeUndefined();

    const adicional = await montar({ puedeCrear: true }, validacion({ tipo: 'Adicional', estado_ppto: 'APROBADO', puede_aprobar: false }));
    expect(boton(adicional.el, 'Nueva versión')).toBeUndefined();

    const sinPermiso = await montar({ puedeCrear: false }, validacion({ estado_ppto: 'APROBADO', puede_aprobar: false }));
    expect(boton(sinPermiso.el, 'Nueva versión')).toBeUndefined();
  });

  it('crear una nueva versión pide confirmación y avisa con el presupuesto nuevo', async () => {
    const m = await montar({ puedeCrear: true }, validacion({ estado_ppto: 'APROBADO', puede_aprobar: false }));
    await clic(m, 'Nueva versión');
    boton(m.el, 'Confirmar nueva versión')?.click();
    const req = m.http.expectOne((r) => r.url.endsWith('/presupuestos/PPTO-2026-007/nueva-version'));
    expect(req.request.method).toBe('POST');
    req.flush({ id: 9, id_presupuesto: 'PPTO-2026-009', numero_version: 2, id_version_de: 7, fases: 2, categorias: 3, items: 5 });
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion({ estado_ppto: 'APROBADO', puede_aprobar: false }));
    await m.render();
    expect(m.eventos.versionCreada).toEqual([expect.objectContaining({ id_presupuesto: 'PPTO-2026-009', numero_version: 2 })]);
  });

  it('un error al nueva versión (la obra ya tiene avance) se muestra', async () => {
    const m = await montar({ puedeCrear: true }, validacion({ estado_ppto: 'APROBADO', puede_aprobar: false }));
    await clic(m, 'Nueva versión');
    boton(m.el, 'Confirmar nueva versión')?.click();
    m.http.expectOne((r) => r.url.endsWith('/nueva-version')).flush({ message: 'La obra ya tiene avance registrado: cree el cambio como presupuesto adicional' }, { status: 409, statusText: 'Conflict' });
    m.detectar();
    m.http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion({ estado_ppto: 'APROBADO', puede_aprobar: false }));
    await m.render();
    expect(m.el.querySelector('[role="alert"]')?.textContent).toContain('presupuesto adicional');
  });

  it('si la validación falla se muestra el error y se puede reintentar', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AprobacionPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AprobacionPanelComponent);
    fixture.componentRef.setInput('idPresupuesto', 'PPTO-2026-007');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/validacion')).flush({ message: 'Presupuesto no encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Presupuesto no encontrado');
    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/validacion')).flush(validacion());
  });
});
