import { hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraResidente } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { ResidenteDialogComponent } from './residente-dialog';

const RESIDENTE: ObraResidente = {
  id: 3,
  nombre_completo: 'Ana Torres',
  rol_obra: 'Residente',
  estado_planta: 'En Planta',
  orden: 1,
};

const abrir = (residente: ObraResidente | null, permisos: PermisosObra) =>
  montar(ResidenteDialogComponent, { isOpen: true, idCentroCosto: 10, residente, permisos });

const guardar = (el: HTMLElement) => el.querySelector('button[type="submit"]');

describe('ResidenteDialogComponent: permisos (obra)', () => {
  it('«Ver ficha» con solo ver: ficha en solo lectura, sin Guardar ni Desasignar', async () => {
    const { el, http } = await abrir(RESIDENTE, permisosObra());

    expect(el.textContent).toContain('Ficha del residente / contacto');
    expect(camposEditables(el)).toHaveLength(0);
    expect(guardar(el)).toBeNull();
    expect(hayBoton(el, 'Desasignar')).toBe(false);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone((r) => r.method !== 'GET');
  });

  it('alta exige crear; edición exige editar; Desasignar exige eliminar', async () => {
    const alta = await abrir(null, permisosObra({ crear: true }));
    expect(guardar(alta.el)).not.toBeNull();
    expect(camposEditables(alta.el).length).toBeGreaterThan(0);

    const altaSinCrear = await abrir(null, permisosObra({ editar: true }));
    expect(guardar(altaSinCrear.el)).toBeNull();

    const edicion = await abrir(RESIDENTE, permisosObra({ editar: true }));
    expect(edicion.el.textContent).toContain('Editar residente / contacto');
    expect(guardar(edicion.el)).not.toBeNull();
    expect(hayBoton(edicion.el, 'Desasignar')).toBe(false);

    const eliminar = await abrir(RESIDENTE, permisosObra({ eliminar: true }));
    expect(guardar(eliminar.el)).toBeNull();
    expect(hayBoton(eliminar.el, 'Desasignar')).toBe(true);
  });

  it('con todos los permisos: editable, Guardar y Desasignar', async () => {
    const { el } = await abrir(RESIDENTE, TODOS_PERMISOS_OBRA);

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(guardar(el)).not.toBeNull();
    expect(hayBoton(el, 'Desasignar')).toBe(true);
  });
});
