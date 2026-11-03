import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { GeneralesDialogComponent } from './generales-dialog';

const esTrabajadores = (r: { url: string }) => r.url.endsWith('/anexo/select');

const abrir = async (permisos = permisosObra()) => {
  const m = await montar(GeneralesDialogComponent, {
    isOpen: true,
    idCentroCosto: 10,
    nombreObra: 'Tienda Norte',
    generales: {
      id: 1,
      direccion: 'Av. Central 450',
      equipo: { jefe_proyecto: { id: 7, nombre: 'Ana Ruiz' }, coordinador: null, residente: null, resp_presupuesto: null, resp_procura: null },
    },
    cabecera: { fecha_inicio: '2026-09-14T00:00:00.000Z', fecha_fin_prog: '2026-11-30T00:00:00.000Z' },
    permisos,
  });
  // La ficha pide la lista de trabajadores al abrirse (equipo de la obra).
  m.http.expectOne(esTrabajadores).flush([{ id: 7, nombre: 'Ana Ruiz' }]);
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
