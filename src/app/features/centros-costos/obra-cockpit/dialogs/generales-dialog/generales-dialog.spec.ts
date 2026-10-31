import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { GeneralesDialogComponent } from './generales-dialog';

const esTrabajadores = (r: { url: string }) => r.url.endsWith('/anexo/select');

const abrir = async (permisos = permisosObra()) => {
  const m = await montar(GeneralesDialogComponent, {
    isOpen: true,
    idCentroCosto: 10,
    generales: {
      id: 1,
      direccion: 'Av. Central 450',
      codigo_obra: 'OP-26-017',
      tienda: 'Tienda Norte',
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
    expect(valor('gen-codigo')).toBe('OP-26-017');
    expect(valor('gen-tienda')).toBe('Tienda Norte');
    expect(valor('gen-inicio')).toBe('2026-09-14');
    expect(valor('gen-fin')).toBe('2026-11-30');
  });

  it('el PATCH lleva las fechas y el equipo; lo que se dejó vacío viaja como null para borrarlo', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    const body = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/generales')).request.body as Record<string, unknown>;
    expect(body['codigo_obra']).toBe('OP-26-017');
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
