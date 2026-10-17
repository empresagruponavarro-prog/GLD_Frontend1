import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { GeneralesDialogComponent } from './generales-dialog';

const abrir = (permisos = permisosObra()) =>
  montar(GeneralesDialogComponent, { isOpen: true, idCentroCosto: 10, generales: { id: 1, direccion: 'Av. Central 450' }, permisos });

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
