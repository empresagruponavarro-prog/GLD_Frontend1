import { hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraResidente } from '../../obra.interface';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { DirectorioTabComponent } from './directorio-tab';

const RESIDENTE: ObraResidente = {
  id: 3,
  nombre_completo: 'Ana Torres',
  rol_obra: 'Residente',
  estado_planta: 'En Planta',
  orden: 1,
};

describe('DirectorioTabComponent: botones según permisos (obra)', () => {
  it('con solo ver no aparece Asignar, pero sí Ver ficha (abre en solo lectura)', async () => {
    const { el, fixture } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: permisosObra() });
    const vistos: ObraResidente[] = [];
    fixture.componentInstance.editar.subscribe((r) => vistos.push(r));

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(false);
    el.querySelector<HTMLButtonElement>('[title="Ver ficha"]')?.click();
    expect(vistos).toEqual([RESIDENTE]);
  });

  it('con crear aparece Asignar', async () => {
    const { el } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: permisosObra({ crear: true }) });

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(true);
  });

  it('con todos los permisos aparecen Asignar y Ver ficha', async () => {
    const { el } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: TODOS_PERMISOS_OBRA });

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(true);
    expect(hayBoton(el, 'Ver ficha')).toBe(true);
  });
});
