import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { GeneralesDialogComponent } from './generales-dialog';

const esTrabajadores = (r: { url: string }) => r.url.endsWith('/anexo/select');
const DEPARTAMENTOS = [{ id: '15', nombre: 'LIMA' }, { id: '04', nombre: 'AREQUIPA' }];
const PROVINCIAS_LIMA = [{ id: '1501', nombre: 'LIMA' }, { id: '1505', nombre: 'CAÑETE' }];
const DISTRITOS_LIMA = [{ id: '150101', nombre: 'LIMA' }, { id: '150142', nombre: 'VILLA EL SALVADOR' }];
/** Responde las listas del ubigeo que la ficha pidió (departamentos y, si hay distrito, sus provincias y distritos). */
const responderUbigeo = (http: { match: (f: (r: { url: string; urlWithParams: string }) => boolean) => { request: { urlWithParams: string }; flush: (b: unknown) => void }[] }) => {
  for (const r of http.match((x) => x.url.includes('/maestros/ubigeo/'))) {
    const u = r.request.urlWithParams;
    r.flush(u.includes('/departamentos') ? DEPARTAMENTOS : u.includes('provincias') ? PROVINCIAS_LIMA : u.includes('distritos?') ? DISTRITOS_LIMA : { id_distrito: '150142', id_provincia: '1501', id_departamento: '15', departamento: 'LIMA', provincia: 'LIMA', distrito: 'VILLA EL SALVADOR' });
  }
};

const abrir = async (permisos = permisosObra(), extra: Record<string, unknown> = {}) => {
  const m = await montar(GeneralesDialogComponent, {
    isOpen: true,
    idCentroCosto: 10,
    nombreObra: 'Tienda Norte',
    generales: {
      id: 1,
      direccion: 'Av. Central 450',
      id_distrito: '150142',
      equipo: { jefe_proyecto: { id: 7, nombre: 'Ana Ruiz' }, coordinador: null, residente: null, resp_presupuesto: null, resp_procura: null },
    },
    cabecera: { fecha_inicio: '2026-09-14T00:00:00.000Z', fecha_fin_prog: '2026-11-30T00:00:00.000Z' },
    permisos,
    ...extra,
  });
  // La ficha pide la lista de trabajadores al abrirse (equipo de la obra).
  m.http.expectOne(esTrabajadores).flush([{ id: 7, nombre: 'Ana Ruiz' }]);
  responderUbigeo(m.http);
  await m.render();
  return m;
};

describe('GeneralesDialogComponent: permisos (obra)', () => {
  it('sin editar: ficha en solo lectura, sin Guardar y el submit no envía nada', async () => {
    const { el, http } = await abrir(permisosObra({ crear: true, eliminar: true }));

    expect(camposEditables(el)).toHaveLength(0);
    expect(el.querySelector('button[type="submit"]')).toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('con editar: editable y Guardar Ficha Técnica envía el PATCH', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Guardar Ficha Técnica');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/generales')).request.method).toBe('PATCH');
  });
});

describe('GeneralesDialogComponent: ficha operativa del control de avance', () => {
  it('precarga código, tienda, fechas programadas y equipo', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA);
    const valor = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)?.value;

    expect(el.querySelector('[data-testid="ficha-operativa"]')).not.toBeNull();
    // Código y tienda se muestran del centro de costo, sin campo para escribirlos.
    expect(el.querySelector('#gen-codigo')?.textContent?.trim()).toBe('CC-10');
    expect(el.querySelector('#gen-tienda')?.textContent?.trim()).toBe('Tienda Norte');
    expect(el.querySelector('input#gen-codigo, input#gen-tienda')).toBeNull();
    expect(valor('gen-inicio')).toBe('2026-09-14');
    expect(valor('gen-fin')).toBe('2026-11-30');
  });

  it('el PATCH lleva las fechas y el equipo; lo que se dejó vacío viaja como null para borrarlo', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    const body = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/generales')).request.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('codigo_obra');
    expect(body).not.toHaveProperty('tienda');
    expect(body['fecha_inicio']).toBe('2026-09-14');
    expect(body['fecha_fin_prog']).toBe('2026-11-30');
    expect(body['id_jefe_proyecto']).toBe(7);
    expect(body['id_coordinador']).toBeNull();
    expect(body['comentario']).toBeNull();
  });

  it('no deja guardar un fin programado anterior al inicio', async () => {
    const { el, http, render } = await abrir(TODOS_PERMISOS_OBRA);
    const fin = el.querySelector<HTMLInputElement>('#gen-fin')!;
    fin.value = '2026-09-01';
    fin.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await render();

    http.expectNone((r) => r.url.endsWith('/operaciones/obra/10/generales'));
    expect(el.textContent).toContain('El fin programado no puede ser anterior al inicio.');
  });
});

describe('GeneralesDialogComponent: plazo fijo una vez iniciada la obra (GRP S-02)', () => {
  it('con la obra iniciada, inicio, fin y semanas son de solo lectura y se explica por qué', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA, { plazoBloqueado: true });

    for (const id of ['gen-inicio', 'gen-fin', 'gen-semanas']) expect(el.querySelector<HTMLInputElement>(`#${id}`)?.disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#gen-avance')?.disabled).toBe(false);
    expect(el.querySelector('[data-testid="nota-plazo"]')?.textContent).toContain('reprogramación');
    expect(el.querySelector('[data-testid="nota-semanas"]')?.textContent).toContain('La obra ya inició');
  });

  it('con la obra iniciada, el PATCH no lleva inicio, fin ni semanas', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA, { plazoBloqueado: true });
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    const body = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/generales')).request.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('fecha_inicio');
    expect(body).not.toHaveProperty('fecha_fin_prog');
    expect(body).not.toHaveProperty('semanas_totales');
  });

  it('antes de iniciar se editan y se avisa que el fin se recalcula con las semanas', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA);

    for (const id of ['gen-inicio', 'gen-fin', 'gen-semanas']) expect(el.querySelector<HTMLInputElement>(`#${id}`)?.disabled).toBe(false);
    expect(el.querySelector('[data-testid="nota-plazo"]')).toBeNull();
    expect(el.querySelector('[data-testid="nota-semanas"]')?.textContent).toContain('se recalcula');
  });
});

describe('GeneralesDialogComponent: imprimir', () => {
  afterEach(() => vi.restoreAllMocks());

  it('imprime una hoja limpia con los datos de la ficha y el nombre del equipo', async () => {
    const { el } = await abrir(permisosObra());
    let html = '';
    const imprimir = vi.fn();
    const ventana = {
      document: { open: vi.fn(), write: (t: string) => (html += t), close: vi.fn() },
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print: imprimir,
    };
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(ventana as unknown as Window);

    el.querySelector<HTMLButtonElement>('button[aria-label="Imprimir ficha técnica"]')?.click();

    expect(imprimir).toHaveBeenCalledOnce();
    expect(html).toContain('Ficha técnica');
    expect(html).toContain('Av. Central 450');
    expect(html).toContain('CC-10');
    expect(html).toContain('Tienda Norte');
    expect(html).toContain('Ana Ruiz');
  });
});

describe('GeneralesDialogComponent: ubicación por ubigeo', () => {
  it('abre con el departamento, la provincia y el distrito guardados elegidos y el ubigeo lleno', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA);
    const elegido = (id: string) => el.querySelector<HTMLSelectElement>(`#${id}`)?.selectedOptions[0]?.textContent?.trim();
    expect(elegido('gen-departamento')).toBe('LIMA');
    expect(elegido('gen-provincia')).toBe('LIMA');
    expect(elegido('gen-distrito')).toBe('VILLA EL SALVADOR');
    expect(el.querySelector<HTMLInputElement>('#gen-ubigeo')?.value).toBe('150142');
  });

  it('cambiar el departamento limpia provincia, distrito y ubigeo, y pide sus provincias', async () => {
    const { el, http, render } = await abrir(TODOS_PERMISOS_OBRA);
    const dep = el.querySelector<HTMLSelectElement>('#gen-departamento');
    if (!dep) throw new Error('falta el departamento');
    dep.value = dep.options[2].value;
    dep.dispatchEvent(new Event('change'));
    await render();
    expect(http.expectOne((r) => r.url.endsWith('/maestros/ubigeo/provincias')).request.params.get('departamento')).toBe('04');
    expect(el.querySelector<HTMLInputElement>('#gen-ubigeo')?.value).toBe('');
  });

  it('el PATCH lleva solo el código del distrito', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    const body = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/generales')).request.body as Record<string, unknown>;
    expect(body['id_distrito']).toBe('150142');
    expect(body).not.toHaveProperty('departamento');
    expect(body).not.toHaveProperty('ubigeo_cod');
  });
});

